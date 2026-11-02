from apps.comun.esquemas import respuesta_objeto
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizaciones.models import Region

from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.comun.permisos import EsAdmin

from .reportes import reporte_excel, reporte_pdf
from .services import indicadores, ranking


class ImpactoView(APIView):
    """
    Indicadores de impacto. Donantes y receptores ven los de su organización;
    voluntarios, los de su región; administradores, todos (filtro opcional ?region=<id>).
    Filtros de fecha opcionales: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
    """

    @respuesta_objeto
    def get(self, request):
        u = request.user
        filtros = {"desde": request.query_params.get("desde"), "hasta": request.query_params.get("hasta")}
        alcance = "global"
        if u.organizacion:
            filtros["organizacion"] = u.organizacion
            alcance = u.organizacion.razon_social
        elif hasattr(u, "perfil_voluntario"):
            filtros["region"] = u.perfil_voluntario.region
            alcance = u.perfil_voluntario.region.nombre
        elif request.query_params.get("region"):
            filtros["region"] = Region.objects.get(pk=request.query_params["region"])
            alcance = filtros["region"].nombre
        datos = indicadores(**filtros)
        datos["alcance"] = alcance
        return Response(datos)


class RankingView(APIView):
    """Voluntarios con más entregas y donantes con más kilos (opcional ?region=<id>)."""

    @respuesta_objeto
    def get(self, request):
        region = request.query_params.get("region")
        if not region and request.user.organizacion_id:
            region = request.user.organizacion.region_id
        elif not region and hasattr(request.user, "perfil_voluntario"):
            region = request.user.perfil_voluntario.region_id
        reg = Region.objects.filter(pk=region).first() if region else None
        datos = ranking(reg)
        datos["alcance"] = reg.nombre if reg else "Todas las regiones"
        return Response(datos)


def _filtros_reporte(request):
    q = request.query_params
    region = Region.objects.filter(pk=q.get("region")).first() if q.get("region") else None
    return {"region": region, "desde": q.get("desde") or None, "hasta": q.get("hasta") or None}


class ReporteExcelView(APIView):
    permission_classes = [EsAdmin]

    @extend_schema(responses={(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): OpenApiTypes.BINARY})
    def get(self, request):
        r = HttpResponse(reporte_excel(**_filtros_reporte(request)),
                         content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        r["Content-Disposition"] = f'attachment; filename="reparte_reporte_{timezone.localdate()}.xlsx"'
        return r


class ReportePDFView(APIView):
    permission_classes = [EsAdmin]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request):
        r = HttpResponse(reporte_pdf(**_filtros_reporte(request)), content_type="application/pdf")
        r["Content-Disposition"] = f'attachment; filename="reparte_impacto_{timezone.localdate()}.pdf"'
        return r
