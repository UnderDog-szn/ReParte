from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def salud(request):
    """Verifica que el servidor está arriba."""
    return JsonResponse({"estado": "ok", "proyecto": "ReParte", "modo": "simulacion"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/salud/", salud),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token"),
    path("api/auth/token/renovar/", TokenRefreshView.as_view(), name="token_renovar"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
