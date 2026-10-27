from apps.comun.esquemas import respuesta_objeto
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizaciones.models import Region

from .services import indicadores


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
