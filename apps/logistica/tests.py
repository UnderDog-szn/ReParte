import io
import json
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.donaciones.models import CategoriaAlimento, Donacion
from apps.emparejamiento.models import Asignacion
from apps.logistica.models import Recogida
from apps.logistica.rutas import calcular_ruta
from apps.usuarios.models import Usuario

OSRM_EJEMPLO = {
    "code": "Ok",
    "routes": [{
        "distance": 3520.4, "duration": 540.0,
        "legs": [{"distance": 1200.0, "duration": 200.0}, {"distance": 2320.4, "duration": 340.0}],
        "geometry": {"type": "LineString", "coordinates": [[-72.91, 11.54], [-72.912, 11.541], [-72.92, 11.53]]},
    }],
}


class RespuestaFalsa(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class RutaTests(TestCase):
    PUNTOS = [{"lat": 11.54, "lon": -72.91, "nombre": "Tú"}, {"lat": 11.541, "lon": -72.912, "nombre": "Donante"},
              {"lat": 11.53, "lon": -72.92, "nombre": "Receptor"}]

    def test_interpreta_respuesta_de_osrm(self):
        with mock.patch("urllib.request.urlopen", return_value=RespuestaFalsa(json.dumps(OSRM_EJEMPLO).encode())):
            r = calcular_ruta(self.PUNTOS)
        self.assertEqual(r["fuente"], "osrm")
        self.assertEqual(r["distancia_km"], 3.52)
        self.assertEqual(r["duracion_min"], 9)
        self.assertEqual(len(r["tramos"]), 2)
        self.assertEqual(r["geometria"][0], [11.54, -72.91])  # se invierte a [lat, lon]

    @override_settings(REPARTE={"OSRM_URL": "http://127.0.0.1:9", "OSRM_TIMEOUT": 1})
    def test_sin_osrm_usa_linea_recta(self):
        r = calcular_ruta(self.PUNTOS)
        self.assertEqual(r["fuente"], "linea_recta")
        self.assertEqual(len(r["geometria"]), 3)
        self.assertGreater(r["distancia_km"], 0)


class SolicitudDirectaTests(TestCase):
    """El receptor elige un excedente; el voluntario lo encuentra y obtiene la ruta."""

    @classmethod
    def setUpTestData(cls):
        call_command("cargar_semilla", stdout=StringIO())

    def cliente(self, usuario):
        c = APIClient()
        c.force_authenticate(Usuario.objects.get(email=f"{usuario}@reparte.test"))
        return c

    def nueva_donacion(self, condicion="AMBIENTE", categoria="Panadería"):
        ahora = timezone.now()
        r = self.cliente("laespiga").post("/api/donaciones/", {
            "categoria": CategoriaAlimento.objects.get(nombre=categoria).pk, "descripcion": "Prueba solicitud",
            "cantidad": 12, "unidad": "KG", "condicion": condicion,
            "fecha_limite_consumo": ahora + timedelta(days=1),
            "recogida_desde": ahora + timedelta(hours=1), "recogida_hasta": ahora + timedelta(hours=3),
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return Donacion.objects.get(pk=r.data["id"])

    @override_settings(REPARTE={"OSRM_URL": "http://127.0.0.1:9", "OSRM_TIMEOUT": 1, "KG_POR_RACION": "0.4"})
    def test_receptor_elige_y_voluntario_ve_la_ruta(self):
        d = self.nueva_donacion()
        sugerida = d.asignaciones.get(estado="SUGERIDA")
        # Un receptor distinto al sugerido la elige desde "Disponibles"
        quien = next(u for u in ["almendros", "manosqueayudan", "laesperanza"]
                     if Usuario.objects.get(email=f"{u}@reparte.test").organizacion_id != sugerida.receptor_id)
        c = self.cliente(quien)
        disponibles = c.get("/api/donaciones/disponibles/").data
        item = next(x for x in disponibles if x["id"] == d.id)
        self.assertTrue(item["compatible"])
        r = c.post(f"/api/donaciones/{d.id}/solicitar/")
        self.assertEqual(r.status_code, 200, r.data)
        d.refresh_from_db()
        self.assertEqual(d.estado, "ASIGNADA")
        sugerida.refresh_from_db()
        self.assertEqual(sugerida.estado, "EXPIRADA")  # la sugerencia al otro receptor se cierra
        self.assertEqual(d.asignaciones.get(estado="ACEPTADA").origen, Asignacion.Origen.SOLICITUD)
        self.assertIsNotNone(r.data["codigo_entrega"])

        # El voluntario la encuentra y pide la ruta
        vol = self.cliente("vol.jose")
        recogida = Recogida.objects.get(donacion=d)
        self.assertIn(recogida.id, [x["id"] for x in vol.get("/api/recogidas/disponibles/").data])
        ruta = vol.get(f"/api/recogidas/{recogida.id}/ruta/?lat=11.545&lon=-72.905").data
        self.assertEqual([p["tipo"] for p in ruta["puntos"]], ["voluntario", "recoger", "entregar"])
        self.assertEqual(len(ruta["tramos"]), 2)

        # No se puede solicitar dos veces
        self.assertEqual(c.post(f"/api/donaciones/{d.id}/solicitar/").status_code, 409)

    def test_no_puede_solicitar_si_no_es_compatible(self):
        d = self.nueva_donacion(condicion="REFRIGERADO", categoria="Lácteos")
        c = self.cliente("almendros")  # el comedor no tiene refrigeración
        item = next(x for x in c.get("/api/donaciones/disponibles/").data if x["id"] == d.id)
        self.assertFalse(item["compatible"])
        r = c.post(f"/api/donaciones/{d.id}/solicitar/")
        self.assertEqual(r.status_code, 409)
        self.assertIn("refrigeración", r.data["detalle"])

    def test_donante_no_puede_solicitar(self):
        d = self.nueva_donacion()
        self.assertEqual(self.cliente("elahorro").post(f"/api/donaciones/{d.id}/solicitar/").status_code, 403)
