from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny

from .registro import RegistroSerializer

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


class RegistroView(APIView):
    """Crea una cuenta nueva. Las organizaciones quedan pendientes de verificación por el administrador."""

    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(request=RegistroSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        ser = RegistroSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        u = ser.save()
        return Response({"id": u.id, "email": u.email, "rol": u.rol,
                         "pendiente_verificacion": bool(u.organizacion_id)}, status=201)
