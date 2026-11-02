from pathlib import Path

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.donaciones.views import CategoriaViewSet, DonacionViewSet, RecurrenteViewSet
from apps.emparejamiento.views import AsignacionViewSet, ExplicarPuntajeView, ProcesarVencimientosView
from apps.impacto.views import ImpactoView, RankingView, ReporteExcelView, ReportePDFView
from apps.logistica.views import CertificadoViewSet, RecogidaViewSet, VerificarCertificadoView
from apps.organizaciones.views import (MiCapacidadView, MiOrganizacionView, PendientesView, ReceptoresView, RegionViewSet,
                                       VerificarView)
from apps.usuarios.views import NotificacionViewSet, RegistroView, YoView

router = DefaultRouter()
router.register("regiones", RegionViewSet, basename="region")
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("donaciones", DonacionViewSet, basename="donacion")
router.register("asignaciones", AsignacionViewSet, basename="asignacion")
router.register("recogidas", RecogidaViewSet, basename="recogida")
router.register("certificados", CertificadoViewSet, basename="certificado")
router.register("notificaciones", NotificacionViewSet, basename="notificacion")
router.register("recurrentes", RecurrenteViewSet, basename="recurrente")


def salud(request):
    """Verifica que el servidor está arriba."""
    return JsonResponse({"estado": "ok", "proyecto": "ReParte", "modo": "simulacion"})


def archivo_pwa(nombre, tipo):
    """Sirve el service worker y el manifest desde la raíz del sitio (alcance de la PWA)."""
    ruta = Path(settings.BASE_DIR) / "static" / "app" / nombre

    def vista(request):
        r = HttpResponse(ruta.read_bytes(), content_type=tipo)
        r["Service-Worker-Allowed"] = "/"
        r["Cache-Control"] = "no-cache"
        return r
    return vista


api = [
    path("salud/", salud),
    path("auth/token/", TokenObtainPairView.as_view(), name="token"),
    path("auth/token/renovar/", TokenRefreshView.as_view(), name="token_renovar"),
    path("auth/yo/", YoView.as_view(), name="yo"),
    path("auth/registro/", RegistroView.as_view(), name="registro"),
    path("organizaciones/mia/capacidad/", MiCapacidadView.as_view(), name="mi_capacidad"),
    path("organizaciones/pendientes/", PendientesView.as_view(), name="pendientes"),
    path("organizaciones/<int:pk>/verificar/", VerificarView.as_view(), name="verificar"),
    path("certificados/verificar/<str:consecutivo>/", VerificarCertificadoView.as_view(), name="verificar_certificado"),
    path("impacto/ranking/", RankingView.as_view(), name="ranking"),
    path("reportes/donaciones.xlsx", ReporteExcelView.as_view(), name="reporte_excel"),
    path("reportes/impacto.pdf", ReportePDFView.as_view(), name="reporte_pdf"),
    path("organizaciones/mia/", MiOrganizacionView.as_view(), name="mi_organizacion"),
    path("organizaciones/receptores/", ReceptoresView.as_view(), name="receptores"),
    path("impacto/", ImpactoView.as_view(), name="impacto"),
    path("simulacion/procesar/", ProcesarVencimientosView.as_view(), name="procesar"),
    path("simulacion/puntaje/<int:donacion_id>/", ExplicarPuntajeView.as_view(), name="puntaje"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api)),
    path("sw.js", archivo_pwa("sw.js", "application/javascript")),
    path("manifest.webmanifest", archivo_pwa("manifest.webmanifest", "application/manifest+json")),
    path("", TemplateView.as_view(template_name="index.html"), name="app"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
