from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.donaciones.views import CategoriaViewSet, DonacionViewSet
from apps.emparejamiento.views import AsignacionViewSet, ExplicarPuntajeView, ProcesarVencimientosView
from apps.impacto.views import ImpactoView
from apps.logistica.views import CertificadoViewSet, RecogidaViewSet
from apps.organizaciones.views import MiOrganizacionView, ReceptoresView, RegionViewSet
from apps.usuarios.views import NotificacionViewSet, YoView

router = DefaultRouter()
router.register("regiones", RegionViewSet, basename="region")
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("donaciones", DonacionViewSet, basename="donacion")
router.register("asignaciones", AsignacionViewSet, basename="asignacion")
router.register("recogidas", RecogidaViewSet, basename="recogida")
router.register("certificados", CertificadoViewSet, basename="certificado")
router.register("notificaciones", NotificacionViewSet, basename="notificacion")


def salud(request):
    """Verifica que el servidor está arriba."""
    return JsonResponse({"estado": "ok", "proyecto": "ReParte", "modo": "simulacion"})


api = [
    path("salud/", salud),
    path("auth/token/", TokenObtainPairView.as_view(), name="token"),
    path("auth/token/renovar/", TokenRefreshView.as_view(), name="token_renovar"),
    path("auth/yo/", YoView.as_view(), name="yo"),
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
    path("", TemplateView.as_view(template_name="index.html"), name="app"),
]
