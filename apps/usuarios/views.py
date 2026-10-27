from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from .serializers import NotificacionSerializer, YoSerializer


class YoView(APIView):
    """Datos del usuario autenticado: rol, organización y perfil."""

    @extend_schema(responses=YoSerializer)
    def get(self, request):
        return Response(YoSerializer(request.user).data)


class NotificacionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificacionSerializer

    def get_queryset(self):
        return self.request.user.notificaciones.all()

    @extend_schema(request=None)
    @action(detail=False, methods=["post"], url_path="leer-todas")
    def leer_todas(self, request):
        n = self.get_queryset().filter(leida=False).update(leida=True)
        return Response({"marcadas": n})
