from django.db.models import Prefetch
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from apps.comun.esquemas import MotivoSerializer
from apps.comun.permisos import EsDonante
from apps.emparejamiento.models import Asignacion
from apps.emparejamiento.services import procesar_vencimientos
from apps.usuarios.models import Usuario

from .models import CategoriaAlimento, Donacion
from .serializers import CategoriaSerializer, DonacionCrearSerializer, DonacionDetalleSerializer, DonacionListaSerializer
from .services import cancelar_donacion, publicar_donacion

ACTIVAS = ["PUBLICADA", "ASIGNADA", "EN_RECOGIDA", "EN_TRANSITO"]


class CategoriaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CategoriaAlimento.objects.filter(activa=True)
    serializer_class = CategoriaSerializer
    pagination_class = None


class DonacionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                      viewsets.GenericViewSet):
    """
    list:     donaciones visibles para el usuario según su rol (?estado=PUBLICADA para filtrar).
    create:   publica un excedente (solo donantes) y lanza el emparejamiento.
    """

    def get_queryset(self):
        u = self.request.user
        qs = Donacion.objects.select_related(
            "donante__region", "categoria", "recogida__voluntario__usuario", "certificado"
        ).prefetch_related(Prefetch("asignaciones", queryset=Asignacion.objects.select_related("receptor")))
        if u.rol == Usuario.Rol.DONANTE:
            qs = qs.filter(donante=u.organizacion)
        elif u.rol == Usuario.Rol.RECEPTOR:
            qs = qs.filter(asignaciones__receptor=u.organizacion, asignaciones__estado="ACEPTADA")
        elif u.rol == Usuario.Rol.VOLUNTARIO:
            qs = qs.filter(recogida__voluntario__usuario=u)
        elif not (u.rol == Usuario.Rol.ADMIN or u.is_superuser):
            qs = qs.none()
        estado = self.request.query_params.get("estado")
        if estado == "ACTIVAS":
            qs = qs.filter(estado__in=ACTIVAS)
        elif estado:
            qs = qs.filter(estado__in=estado.split(","))
        return qs.distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return DonacionCrearSerializer
        if self.action == "retrieve":
            return DonacionDetalleSerializer
        return DonacionListaSerializer

    def get_permissions(self):
        if self.action in ("create", "cancelar"):
            return [EsDonante()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        procesar_vencimientos()  # simula la tarea periódica de Celery Beat
        return super().list(request, *args, **kwargs)

    @extend_schema(request=DonacionCrearSerializer, responses={201: DonacionDetalleSerializer})
    def create(self, request, *args, **kwargs):
        ser = DonacionCrearSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        donacion = publicar_donacion(request.user, ser.validated_data)
        donacion = self.get_queryset().get(pk=donacion.pk)
        return Response(DonacionDetalleSerializer(donacion, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(request=MotivoSerializer, responses=DonacionDetalleSerializer)
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        donacion = self.get_object()
        cancelar_donacion(donacion, request.user, request.data.get("motivo", ""))
        return Response(DonacionDetalleSerializer(self.get_queryset().get(pk=pk), context={"request": request}).data)

    @action(detail=False)
    def mapa(self, request):
        """Donaciones activas de la región del usuario (todas si es administrador)."""
        qs = Donacion.objects.filter(estado__in=ACTIVAS).select_related("donante", "categoria").prefetch_related(
            Prefetch("asignaciones", queryset=Asignacion.objects.select_related("receptor")))
        u = request.user
        region = u.organizacion.region_id if u.organizacion else getattr(getattr(u, "perfil_voluntario", None), "region_id", None)
        if region:
            qs = qs.filter(donante__region_id=region)
        return Response(DonacionListaSerializer(qs, many=True, context={"request": request}).data)
