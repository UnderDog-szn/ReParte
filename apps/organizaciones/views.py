from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.comun.esquemas import VerificarSerializer
from apps.comun.excepciones import ErrorNegocio
from apps.comun.permisos import EsAdmin, EsReceptor

from .models import Organizacion, Region
from .serializers import CapacidadEditarSerializer, OrganizacionDetalleSerializer, RegionSerializer
from .services import actualizar_capacidad, verificar_organizacion


class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Region.objects.filter(activa=True)
    serializer_class = RegionSerializer
    permission_classes = [AllowAny]  # se usa en el formulario de registro
    pagination_class = None


class MiOrganizacionView(APIView):
    @extend_schema(responses=OrganizacionDetalleSerializer)
    def get(self, request):
        if not request.user.organizacion:
            raise ErrorNegocio("No perteneces a ninguna organización.")
        return Response(OrganizacionDetalleSerializer(request.user.organizacion).data)


class ReceptoresView(generics.ListAPIView):
    """Receptores verificados (para el mapa)."""

    serializer_class = OrganizacionDetalleSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Organizacion.objects.filter(tipo="RECEPTOR", estado_verificacion="VERIFICADA").select_related(
            "region", "capacidad").prefetch_related("horarios")
        region = self.request.query_params.get("region")
        return qs.filter(region_id=region) if region else qs


class MiCapacidadView(APIView):
    """El receptor edita su capacidad y su horario de recepción."""

    permission_classes = [EsReceptor]

    @extend_schema(request=CapacidadEditarSerializer, responses=OrganizacionDetalleSerializer)
    def put(self, request):
        ser = CapacidadEditarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        datos = dict(ser.validated_data)
        horarios = datos.pop("horarios", None)
        actualizar_capacidad(request.user.organizacion, datos, horarios)
        org = Organizacion.objects.select_related("region", "capacidad").prefetch_related("horarios").get(pk=request.user.organizacion_id)
        return Response(OrganizacionDetalleSerializer(org).data)


class PendientesView(generics.ListAPIView):
    """Organizaciones registradas que esperan verificación."""

    serializer_class = OrganizacionDetalleSerializer
    permission_classes = [EsAdmin]
    pagination_class = None

    def get_queryset(self):
        return Organizacion.objects.filter(estado_verificacion="PENDIENTE").select_related(
            "region", "capacidad").prefetch_related("horarios", "miembros").order_by("creado_en")


class VerificarView(APIView):
    permission_classes = [EsAdmin]

    @extend_schema(request=VerificarSerializer, responses=OrganizacionDetalleSerializer)
    def post(self, request, pk):
        ser = VerificarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org = verificar_organizacion(get_object_or_404(Organizacion, pk=pk), request.user,
                                     ser.validated_data["aprobada"], ser.validated_data.get("motivo", ""))
        return Response(OrganizacionDetalleSerializer(org).data)
