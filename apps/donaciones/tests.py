"""Pruebas de las funciones agregadas: fotos, calificación, recurrentes, registro, verificación,
capacidad, seguimiento, certificado PDF, ranking, reportes y PWA."""
import io
import shutil
import tempfile
from datetime import time, timedelta
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.donaciones.models import CategoriaAlimento, Donacion, PublicacionRecurrente
from apps.donaciones.services import generar_recurrentes
from apps.organizaciones.models import Organizacion, Region
from apps.usuarios.models import Usuario

MEDIA_TEMP = tempfile.mkdtemp()


def imagen(nombre="foto.jpg"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), (200, 120, 60)).save(buf, "JPEG")
    return SimpleUploadedFile(nombre, buf.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=MEDIA_TEMP)
class FuncionesNuevasTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_semilla", stdout=StringIO())
        cls.admin = Usuario.objects.create_superuser(email="admin@prueba.test", password="Clave-segura-123")

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_TEMP, ignore_errors=True)

    def cliente(self, usuario):
        c = APIClient()
        c.force_authenticate(usuario if isinstance(usuario, Usuario) else Usuario.objects.get(email=f"{usuario}@reparte.test"))
        return c

    def test_foto_de_publicacion(self):
        d = Donacion.objects.filter(donante__razon_social="Supermercado El Ahorro", estado="PUBLICADA").first()
        r = self.cliente("elahorro").post(f"/api/donaciones/{d.id}/fotos/", {"imagen": imagen(), "etapa": "PUBLICACION"}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["foto"])
        # Otro donante no puede subir fotos a esta donación
        r = self.cliente("laespiga").post(f"/api/donaciones/{d.id}/fotos/", {"imagen": imagen()}, format="multipart")
        self.assertIn(r.status_code, (404, 409))
        # Solo imágenes
        texto = SimpleUploadedFile("x.txt", b"hola", content_type="text/plain")
        r = self.cliente("elahorro").post(f"/api/donaciones/{d.id}/fotos/", {"imagen": texto}, format="multipart")
        self.assertEqual(r.status_code, 409)

    def test_calificacion_por_el_receptor(self):
        d = Donacion.objects.filter(estado="ENTREGADA", calificacion__isnull=True).select_related("recogida__asignacion__receptor").first()
        receptor = d.recogida.asignacion.receptor.miembros.first()
        c = self.cliente(receptor)
        self.assertTrue(c.get(f"/api/donaciones/{d.id}/").data["puede_calificar"])
        r = c.post(f"/api/donaciones/{d.id}/calificar/", {"calidad": 4, "servicio": 5, "comentario": "Bien"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["calificacion"]["calidad_alimento"], 4)
        self.assertEqual(c.post(f"/api/donaciones/{d.id}/calificar/", {"calidad": 3}, format="json").status_code, 409)

    def test_recurrente_se_publica_sola(self):
        r = self.cliente("elahorro").post("/api/recurrentes/", {
            "categoria": CategoriaAlimento.objects.get(nombre="Frutas y verduras").pk, "descripcion": "Fruta madura diaria",
            "cantidad": 20, "unidad": "KG", "condicion": "AMBIENTE", "dias": [0, 1, 2, 3, 4, 5, 6],
            "hora_publicacion": "00:00", "horas_para_recoger": 3, "horas_vida_util": 24}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        # a las 00:00 ya pasó: no se publica hoy (el donante acaba de publicar a mano)
        self.assertEqual(PublicacionRecurrente.objects.get(pk=r.data["id"]).ultima_publicacion, timezone.localdate())
        PublicacionRecurrente.objects.filter(pk=r.data["id"]).update(ultima_publicacion=None)  # simula que es otro día
        antes = Donacion.objects.count()
        self.assertGreaterEqual(generar_recurrentes(), 1)
        self.assertEqual(Donacion.objects.count(), antes + 1)
        self.assertEqual(generar_recurrentes(), 0)  # no se duplica el mismo día
        self.assertEqual(PublicacionRecurrente.objects.get(pk=r.data["id"]).ultima_publicacion, timezone.localdate())

    def test_registro_y_verificacion(self):
        c = APIClient()
        datos = {"rol": "RECEPTOR", "email": "nuevo@prueba.test", "password": "Comedor-2026-seguro", "first_name": "Ana",
                 "telefono": "3000000000", "acepta_politica": True, "region": Region.objects.get(nombre="Riohacha").pk,
                 "razon_social": "Comedor Nuevo", "nit": "901234567-8", "categoria": "COMEDOR", "direccion": "Calle 1",
                 "latitud": "11.540000", "longitud": "-72.910000", "capacidad_kg_dia": "80", "personas_atendidas": 100}
        r = c.post("/api/auth/registro/", datos, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["pendiente_verificacion"])
        nuevo = Usuario.objects.get(email="nuevo@prueba.test")
        self.assertEqual(self.cliente(nuevo).get("/api/donaciones/disponibles/").status_code, 403)  # aún sin verificar
        org = nuevo.organizacion
        adm = self.cliente(self.admin)
        self.assertIn(org.id, [o["id"] for o in adm.get("/api/organizaciones/pendientes/").data])
        self.assertEqual(adm.post(f"/api/organizaciones/{org.id}/verificar/", {"aprobada": True}, format="json").status_code, 200)
        nuevo.refresh_from_db()
        self.assertEqual(self.cliente(nuevo).get("/api/donaciones/disponibles/").status_code, 200)
        # correo repetido
        self.assertEqual(c.post("/api/auth/registro/", datos, format="json").status_code, 400)

    def test_receptor_edita_capacidad_y_horarios(self):
        c = self.cliente("almendros")
        r = c.put("/api/organizaciones/mia/capacidad/", {
            "capacidad_kg_dia": "150", "tiene_refrigeracion": True,
            "horarios": [{"dia_semana": 0, "hora_inicio": "08:00", "hora_fin": "12:00"},
                         {"dia_semana": 2, "hora_inicio": "14:00", "hora_fin": "18:00"}]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["capacidad"]["capacidad_kg_dia"], "150.00")
        self.assertTrue(r.data["capacidad"]["tiene_refrigeracion"])
        self.assertEqual(len(r.data["horarios"]), 2)
        mal = c.put("/api/organizaciones/mia/capacidad/", {"horarios": [{"dia_semana": 1, "hora_inicio": "10:00", "hora_fin": "09:00"}]}, format="json")
        self.assertEqual(mal.status_code, 409)

    def test_seguimiento_en_vivo(self):
        d = Donacion.objects.filter(estado="ASIGNADA").select_related("recogida", "donante").first()
        vol = self.cliente("vol.laura")  # tiene cava de frío (la asignada es de lácteos)
        self.assertEqual(vol.post(f"/api/recogidas/{d.recogida.id}/tomar/").status_code, 200)
        self.assertEqual(vol.post(f"/api/recogidas/{d.recogida.id}/ubicacion/", {"lat": 11.543, "lon": -72.909}, format="json").status_code, 200)
        s = self.cliente("elahorro").get(f"/api/donaciones/{d.id}/seguimiento/").data
        self.assertEqual(s["posicion"]["lat"], 11.543)
        self.assertEqual(self.cliente("laespiga").get(f"/api/donaciones/{d.id}/seguimiento/").status_code, 409)

    def test_certificado_pdf_y_verificacion(self):
        c = self.cliente("elahorro")
        cert = c.get("/api/certificados/").data[0]
        r = c.get(f"/api/certificados/{cert['id']}/pdf/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b"%PDF"))
        v = APIClient().get(f"/api/certificados/verificar/{cert['consecutivo']}/")
        self.assertTrue(v.data["valido"])

    def test_ranking_y_reportes(self):
        r = self.cliente("vol.andres").get("/api/impacto/ranking/").data
        self.assertTrue(r["voluntarios"] or r["donantes"])
        adm = self.cliente(self.admin)
        x = adm.get("/api/reportes/donaciones.xlsx")
        self.assertEqual(x.status_code, 200)
        self.assertTrue(x.content.startswith(b"PK"))  # xlsx = zip
        p = adm.get("/api/reportes/impacto.pdf")
        self.assertTrue(p.content.startswith(b"%PDF"))
        self.assertEqual(self.cliente("elahorro").get("/api/reportes/impacto.pdf").status_code, 403)

    def test_pwa(self):
        c = APIClient()
        self.assertEqual(c.get("/manifest.webmanifest").status_code, 200)
        r = c.get("/sw.js")
        self.assertEqual(r["Service-Worker-Allowed"], "/")
