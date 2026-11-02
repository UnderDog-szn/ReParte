from django.db.models import Prefetch
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.comun.excepciones import ErrorNegocio
from apps.comun.esquemas import CalificarSerializer

from apps.comun.esquemas import MotivoSerializer
from apps.comun.permisos import EsDonante, EsReceptor
from apps.emparejamiento.models import Asignacion
from apps.emparejamiento.services import donaciones_disponibles, procesar_vencimientos, solicitar_donacion
from apps.usuarios.models import Usuario

from .models import CategoriaAlimento, Donacion
from .serializers import (CategoriaSerializer, DonacionCrearSerializer, DonacionDetalleSerializer,
                          DonacionDisponibleSerializer, DonacionListaSerializer, RecurrenteSerializer)
from apps.logistica.services import seguimiento

from .models import PublicacionRecurrente
from .services import agregar_foto, calificar_donacion, cancelar_donacion, publicar_donacion

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
            "donante__region", "categoria", "recogida__voluntario__usuario", "certificado", "calificacion"
        ).prefetch_related(Prefetch("asignaciones", queryset=Asignacion.objects.select_related("receptor")), "fotos")
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
        if self.action in ("disponibles", "solicitar"):
            return [EsReceptor()]
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

    @extend_schema(responses=DonacionDisponibleSerializer(many=True))
    @action(detail=False)
    def disponibles(self, request):
        """Excedentes publicados en la región del receptor para que elija cuál solicitar."""
        procesar_vencimientos()
        datos = donaciones_disponibles(request.user.organizacion)
        return Response(DonacionDisponibleSerializer(datos, many=True, context={"request": request}).data)

    @extend_schema(request=None, responses=DonacionDetalleSerializer)
    @action(detail=True, methods=["post"])
    def solicitar(self, request, pk=None):
        """El receptor elige este excedente: queda asignado a él y se avisa a los voluntarios."""
        solicitar_donacion(get_object_or_404(Donacion, pk=pk), request.user)
        return Response(DonacionDetalleSerializer(Donacion.objects.get(pk=pk), context={"request": request}).data)

    @extend_schema(request={"multipart/form-data": {"type": "object", "properties": {
        "imagen": {"type": "string", "format": "binary"}, "etapa": {"type": "string", "enum": ["PUBLICACION", "RECOGIDA", "ENTREGA"]}}}},
        responses=DonacionDetalleSerializer)
    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser], permission_classes=[IsAuthenticated])
    def fotos(self, request, pk=None):
        """Sube una foto (JPG/PNG/WEBP, máx. 5 MB) de la publicación, la recogida o la entrega."""
        donacion = self.get_object()
        archivo = request.FILES.get("imagen")
        if not archivo:
            raise ErrorNegocio("Adjunta la imagen en el campo 'imagen'.")
        agregar_foto(donacion, request.user, archivo, request.data.get("etapa", "PUBLICACION"))
        return Response(DonacionDetalleSerializer(self.get_queryset().get(pk=pk), context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(request=CalificarSerializer, responses=DonacionDetalleSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def calificar(self, request, pk=None):
        """El receptor califica la calidad del alimento y el servicio del voluntario (1 a 5)."""
        ser = CalificarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        calificar_donacion(self.get_object(), request.user, **ser.validated_data)
        return Response(DonacionDetalleSerializer(self.get_queryset().get(pk=pk), context={"request": request}).data)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, permission_classes=[IsAuthenticated])
    def seguimiento(self, request, pk=None):
        """Posición en vivo del voluntario (para el donante, el receptor o el administrador)."""
        return Response(seguimiento(get_object_or_404(Donacion.objects.select_related("donante", "recogida__voluntario__usuario",
                                                                                         "recogida__asignacion__receptor"), pk=pk), request.user))

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


class RecurrenteViewSet(viewsets.ModelViewSet):
    """Publicaciones automáticas del donante (se publican solas los días y a la hora indicados)."""

    serializer_class = RecurrenteSerializer
    permission_classes = [EsDonante]
    pagination_class = None
    parser_classes = [JSONParser]

    def get_queryset(self):
        return PublicacionRecurrente.objects.filter(donante=self.request.user.organizacion).select_related("categoria")

    def perform_create(self, serializer):
        # Si la hora de hoy ya pasó, la primera publicación automática será el próximo día marcado
        # (evita duplicar lo que el donante acaba de publicar a mano).
        ahora = timezone.localtime()
        hora = serializer.validated_data["hora_publicacion"]
        serializer.save(donante=self.request.user.organizacion, creado_por=self.request.user,
                        ultima_publicacion=ahora.date() if hora <= ahora.time() else None)
