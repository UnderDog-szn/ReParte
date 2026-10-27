from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comun.esquemas import MotivoSerializer, respuesta_objeto, sin_cuerpo
from apps.comun.permisos import EsAdmin, EsReceptor
from apps.donaciones.models import Donacion

from .models import Asignacion
from .serializers import AsignacionSerializer
from .services import aceptar_asignacion, evaluar, procesar_vencimientos, rechazar_asignacion


class AsignacionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Donaciones sugeridas a la organización receptora del usuario."""

    serializer_class = AsignacionSerializer
    permission_classes = [EsReceptor]
    pagination_class = None

    def get_queryset(self):
        return Asignacion.objects.filter(receptor=self.request.user.organizacion).select_related(
            "donacion__donante", "donacion__categoria", "receptor").order_by("-creado_en")

    @action(detail=False)
    def pendientes(self, request):
        procesar_vencimientos()
        qs = self.get_queryset().filter(estado=Asignacion.Estado.SUGERIDA)
        return Response(self.get_serializer(qs, many=True).data)

    @sin_cuerpo
    @action(detail=True, methods=["post"])
    def aceptar(self, request, pk=None):
        a = aceptar_asignacion(self.get_object(), request.user)
        a.refresh_from_db()
        return Response(self.get_serializer(a).data)

    @extend_schema(request=MotivoSerializer, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        a, siguiente = rechazar_asignacion(self.get_object(), request.user, request.data.get("motivo", ""))
        return Response({"rechazada": a.id, "reasignada_a": siguiente.receptor.razon_social if siguiente else None})


class ExplicarPuntajeView(APIView):
    """Muestra cómo puntuaría el algoritmo a cada receptor para una donación (útil para la sustentación)."""

    permission_classes = [EsAdmin]

    @respuesta_objeto
    def get(self, request, donacion_id):
        d = Donacion.objects.select_related("donante__region", "categoria").get(pk=donacion_id)
        return Response({
            "donacion": d.codigo,
            "pesos": {"w1_proximidad": d.donante.region.peso_distancia, "w2_urgencia": d.donante.region.peso_urgencia,
                      "w3_necesidad": d.donante.region.peso_necesidad, "w4_equidad": d.donante.region.peso_equidad},
            "candidatos": [{"receptor": c.receptor.razon_social, "distancia_km": round(c.distancia_km, 2),
                            "puntaje": c.puntaje, "factores": c.factores} for c in evaluar(d)],
        })


class ProcesarVencimientosView(APIView):
    """Ejecuta a mano lo que en producción haría Celery Beat."""

    permission_classes = [EsAdmin]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        return Response(procesar_vencimientos())
