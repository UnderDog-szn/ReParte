from rest_framework import generics, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.comun.excepciones import ErrorNegocio

from .models import Organizacion, Region
from .serializers import OrganizacionDetalleSerializer, RegionSerializer


class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Region.objects.filter(activa=True)
    serializer_class = RegionSerializer


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
