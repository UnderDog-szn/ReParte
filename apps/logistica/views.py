from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.comun.excepciones import ErrorNegocio

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.comun.esquemas import CodigoSerializer, MotivoSerializer, TemperaturaSerializer, UbicacionSerializer, sin_cuerpo
from apps.comun.permisos import EsDonante, EsVoluntario
from apps.emparejamiento.services import procesar_vencimientos

from . import services
from .models import Certificado, Recogida
from .pdf import certificado_pdf
from .rutas import ruta_de_recogida
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

    @extend_schema(parameters=[OpenApiParameter("lat", float, required=False), OpenApiParameter("lon", float, required=False)],
                   responses=OpenApiTypes.OBJECT)
    @action(detail=True)
    def ruta(self, request, pk=None):
        """Ruta para el voluntario: su ubicación (opcional) → donante → receptor, calculada con OSRM."""
        r = self.get_object()
        perfil = self._perfil()
        if not (r.voluntario_id == perfil.pk or (r.estado == "DISPONIBLE" and r.donacion.donante.region_id == perfil.region_id)):
            raise ErrorNegocio("No puedes ver la ruta de esta recogida.")
        lat, lon = request.query_params.get("lat"), request.query_params.get("lon")
        try:
            lat, lon = (float(lat), float(lon)) if lat and lon else (None, None)
        except ValueError:
            lat = lon = None
        return Response(ruta_de_recogida(r, lat, lon))

    @extend_schema(request=UbicacionSerializer, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"])
    def ubicacion(self, request, pk=None):
        """El voluntario comparte su posición durante la recogida (seguimiento en vivo)."""
        p = services.actualizar_ubicacion(self.get_object(), self._perfil(), request.data.get("lat"), request.data.get("lon"))
        return Response({"lat": p.latitud, "lon": p.longitud, "actualizada_en": p.ubicacion_actualizada_en})

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
            "donacion__recogida__asignacion__receptor", "donacion__donante", "donacion__categoria")

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    @action(detail=True)
    def pdf(self, request, pk=None):
        """Descarga el certificado en PDF."""
        c = self.get_object()
        url = request.build_absolute_uri(f"/api/certificados/verificar/{c.consecutivo}/")
        r = HttpResponse(certificado_pdf(c, url), content_type="application/pdf")
        r["Content-Disposition"] = f'attachment; filename="certificado_{c.consecutivo}.pdf"'
        return r


class VerificarCertificadoView(APIView):
    """Verificación pública de un certificado por su consecutivo (para terceros)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, consecutivo):
        c = get_object_or_404(Certificado.objects.select_related("donacion__donante"), consecutivo=consecutivo)
        return Response({"valido": True, "consecutivo": c.consecutivo, "donante": c.donacion.donante.razon_social,
                         "kg": c.kg_certificados, "emitido_en": c.emitido_en, "hash_sha256": c.hash_sha256})
