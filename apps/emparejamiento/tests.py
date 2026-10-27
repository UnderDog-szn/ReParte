from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.donaciones.models import CategoriaAlimento, Donacion
from apps.emparejamiento.models import Asignacion
from apps.emparejamiento.services import calcular_puntaje, expirar_asignaciones
from apps.logistica.models import Certificado
from apps.usuarios.models import Usuario

PESOS = (0.35, 0.30, 0.20, 0.15)


class PuntajeTests(TestCase):
    """Pruebas de la función pura del algoritmo."""

    def base(self, **cambios):
        datos = dict(distancia_km=2, radio_km=10, horas_restantes=24, nivel_necesidad=3,
                     recibidas_7d=0, max_recibidas=0, pesos=PESOS)
        datos.update(cambios)
        return calcular_puntaje(**datos)[0]

    def test_mas_cerca_mas_puntaje(self):
        self.assertGreater(self.base(distancia_km=1), self.base(distancia_km=8))

    def test_mas_urgente_mas_puntaje(self):
        self.assertGreater(self.base(horas_restantes=3), self.base(horas_restantes=60))

    def test_mas_necesidad_mas_puntaje(self):
        self.assertGreater(self.base(nivel_necesidad=5), self.base(nivel_necesidad=1))

    def test_equidad_penaliza_al_que_mas_recibio(self):
        self.assertGreater(self.base(recibidas_7d=0, max_recibidas=4), self.base(recibidas_7d=4, max_recibidas=4))

    def test_puntaje_entre_0_y_1(self):
        self.assertLessEqual(self.base(distancia_km=0, horas_restantes=0, nivel_necesidad=5), 1)
        self.assertGreaterEqual(self.base(distancia_km=50, horas_restantes=500, nivel_necesidad=1,
                                          recibidas_7d=3, max_recibidas=3), 0)


class FlujoCompletoTests(TestCase):
    """Publicar → emparejar → aceptar → tomar → recoger → entregar → certificar, a través de la API."""

    @classmethod
    def setUpTestData(cls):
        call_command("cargar_semilla", stdout=StringIO())

    def cliente(self, usuario):
        c = APIClient()
        c.force_authenticate(Usuario.objects.get(email=f"{usuario}@reparte.test"))
        return c

    def publicar(self, kg=30):
        ahora = timezone.now()
        return self.cliente("elahorro").post("/api/donaciones/", {
            "categoria": CategoriaAlimento.objects.get(nombre="Frutas y verduras").pk,
            "descripcion": "Prueba de flujo", "cantidad": kg, "unidad": "KG", "condicion": "AMBIENTE",
            "fecha_limite_consumo": ahora + timedelta(days=1),
            "recogida_desde": ahora + timedelta(hours=1), "recogida_hasta": ahora + timedelta(hours=3),
        }, format="json")

    def test_flujo_completo(self):
        r = self.publicar()
        self.assertEqual(r.status_code, 201, r.data)
        donacion = Donacion.objects.get(pk=r.data["id"])
        asignacion = donacion.asignaciones.get(estado="SUGERIDA")
        receptor = asignacion.receptor.miembros.first()
        c_rec = APIClient()
        c_rec.force_authenticate(receptor)

        # El receptor la ve en pendientes y la acepta
        pendientes = c_rec.get("/api/asignaciones/pendientes/").data
        self.assertIn(asignacion.id, [p["id"] for p in pendientes])
        self.assertEqual(c_rec.post(f"/api/asignaciones/{asignacion.id}/aceptar/").status_code, 200)
        donacion.refresh_from_db()
        self.assertEqual(donacion.estado, "ASIGNADA")

        # Un voluntario de la región la toma y la recoge
        vol = self.cliente("vol.andres")
        disponibles = vol.get("/api/recogidas/disponibles/").data
        recogida_id = next(x["id"] for x in disponibles if x["codigo_donacion"] == donacion.codigo)
        self.assertEqual(vol.post(f"/api/recogidas/{recogida_id}/tomar/").status_code, 200)
        self.assertEqual(vol.post(f"/api/recogidas/{recogida_id}/recoger/", {}, format="json").status_code, 200)

        # Código incorrecto → 409; correcto → entregada con certificado
        r = vol.post(f"/api/recogidas/{recogida_id}/entregar/", {"codigo": "000000x"}, format="json")
        self.assertEqual(r.status_code, 409)
        codigo = c_rec.get(f"/api/donaciones/{donacion.id}/").data["codigo_entrega"]
        r = vol.post(f"/api/recogidas/{recogida_id}/entregar/", {"codigo": codigo}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        donacion.refresh_from_db()
        self.assertEqual(donacion.estado, "ENTREGADA")
        self.assertTrue(Certificado.objects.filter(donacion=donacion).exists())

    def test_rechazo_reasigna_al_siguiente(self):
        donacion = Donacion.objects.get(pk=self.publicar().data["id"])
        primera = donacion.asignaciones.get(estado="SUGERIDA")
        c = APIClient()
        c.force_authenticate(primera.receptor.miembros.first())
        r = c.post(f"/api/asignaciones/{primera.id}/rechazar/", {"motivo": "Sin espacio"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIsNotNone(r.data["reasignada_a"])
        self.assertEqual(donacion.asignaciones.filter(estado="SUGERIDA").count(), 1)
        self.assertNotEqual(donacion.asignaciones.get(estado="SUGERIDA").receptor, primera.receptor)

    def test_expiracion_reasigna(self):
        donacion = Donacion.objects.get(pk=self.publicar().data["id"])
        Asignacion.objects.filter(donacion=donacion).update(expira_en=timezone.now() - timedelta(minutes=1))
        self.assertGreaterEqual(expirar_asignaciones(), 1)
        self.assertTrue(donacion.asignaciones.filter(estado="EXPIRADA").exists())

    def test_voluntario_no_puede_publicar(self):
        r = self.cliente("vol.andres").post("/api/donaciones/", {}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_donante_solo_ve_sus_donaciones(self):
        datos = self.cliente("elahorro").get("/api/donaciones/").data["results"]
        self.assertTrue(datos)
        self.assertTrue(all(d["donante"]["razon_social"] == "Supermercado El Ahorro" for d in datos))

    def test_no_se_cancela_una_entregada(self):
        d = Donacion.objects.filter(donante__razon_social="Supermercado El Ahorro", estado="ENTREGADA").first()
        r = self.cliente("elahorro").post(f"/api/donaciones/{d.id}/cancelar/", {}, format="json")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.data["error"], "transicion_invalida")
