from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from apps.comun.esquemas import CodigoSerializer, MotivoSerializer, TemperaturaSerializer, sin_cuerpo
from apps.comun.permisos import EsDonante, EsVoluntario
from apps.emparejamiento.services import procesar_vencimientos

from . import services
from .models import Certificado, Recogida
from .serializers import CertificadoSerializer, RecogidaSerializer

RELACIONES = ("donacion__donante", "donacion__categoria", "asignacion__receptor", "voluntario__usuario")


class RecogidaViewSet(viewsets.GenericViewSet):
    serializer_class = RecogidaSerializer
    permission_classes = [EsVoluntario]

    def get_queryset(self):
        return Recogida.objects.select_related(*RELACIONES)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["perfil"] = getattr(self.request.user, "perfil_voluntario", None)
        return ctx

    def _perfil(self):
        return self.request.user.perfil_voluntario

    def _responder(self, recogida):
        return Response(self.get_serializer(self.get_queryset().get(pk=recogida.pk)).data)

    @action(detail=False)
    def disponibles(self, request):
        procesar_vencimientos()
        return Response(self.get_serializer(services.recogidas_disponibles(self._perfil()), many=True).data)

    @action(detail=False)
    def activa(self, request):
        r = services.recogida_activa(self._perfil())
        return Response(self.get_serializer(r).data if r else None)

    @action(detail=False)
    def historial(self, request):
        qs = self.get_queryset().filter(voluntario=self._perfil(), estado="ENTREGADA").order_by("-entregada_en")
        return Response(self.get_serializer(qs, many=True).data)

    @sin_cuerpo
    @action(detail=True, methods=["post"])
    def tomar(self, request, pk=None):
        return self._responder(services.tomar_recogida(self.get_object(), self._perfil()))

    @extend_schema(request=TemperaturaSerializer)
    @action(detail=True, methods=["post"])
    def recoger(self, request, pk=None):
        temp = request.data.get("temperatura") or None
        return self._responder(services.registrar_recogida(self.get_object(), self._perfil(), temp))

    @extend_schema(request=CodigoSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def entregar(self, request, pk=None):
        """Lo puede confirmar el voluntario (con el código que le da el receptor) o el propio receptor."""
        r = Recogida.objects.select_related(*RELACIONES).get(pk=pk)
        r = services.registrar_entrega(r, request.user, request.data.get("codigo", ""), request.data.get("temperatura") or None)
        return Response(RecogidaSerializer(self.get_queryset().get(pk=r.pk)).data)

    @extend_schema(request=MotivoSerializer)
    @action(detail=True, methods=["post"])
    def liberar(self, request, pk=None):
        return self._responder(services.liberar_recogida(self.get_object(), self._perfil(), request.data.get("motivo", "")))


class CertificadoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = CertificadoSerializer
    permission_classes = [EsDonante]
    pagination_class = None

    def get_queryset(self):
        return Certificado.objects.filter(donacion__donante=self.request.user.organizacion).select_related(
            "donacion__recogida__asignacion__receptor")
