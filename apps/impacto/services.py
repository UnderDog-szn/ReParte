from decimal import Decimal

from django.conf import settings
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncMonth

from apps.logistica.models import Recogida
from apps.organizaciones.models import Organizacion

CERO = Decimal("0")


def indicadores(*, region=None, organizacion=None, desde=None, hasta=None):
    """Indicadores de impacto calculados sobre las recogidas entregadas."""
    qs = Recogida.objects.filter(estado=Recogida.Estado.ENTREGADA)
    if region:
        qs = qs.filter(donacion__donante__region=region)
    if organizacion:
        campo = "donacion__donante" if organizacion.tipo == Organizacion.Tipo.DONANTE else "asignacion__receptor"
        qs = qs.filter(**{campo: organizacion})
    if desde:
        qs = qs.filter(entregada_en__date__gte=desde)
    if hasta:
        qs = qs.filter(entregada_en__date__lte=hasta)

    co2 = ExpressionWrapper(F("donacion__peso_estimado_kg") * F("donacion__categoria__factor_co2"),
                            output_field=DecimalField(max_digits=14, decimal_places=3))
    tot = qs.aggregate(
        donaciones=Count("id"),
        kg=Sum("donacion__peso_estimado_kg"),
        co2=Sum(co2),
        receptores=Count("asignacion__receptor", distinct=True),
        voluntarios=Count("voluntario", distinct=True),
    )
    kg = tot["kg"] or CERO
    kg_por_racion = Decimal(settings.REPARTE.get("KG_POR_RACION", "0.4"))
    por_mes = (
        qs.annotate(mes=TruncMonth("entregada_en")).values("mes")
        .annotate(kg=Sum("donacion__peso_estimado_kg"), donaciones=Count("id")).order_by("mes")
    )
    return {
        "donaciones_entregadas": tot["donaciones"],
        "kg_rescatados": kg,
        "raciones_equivalentes": int(kg / kg_por_racion),
        "kg_co2_evitados": tot["co2"] or CERO,
        "receptores_atendidos": tot["receptores"],
        "voluntarios_activos": tot["voluntarios"],
        "por_mes": [{"mes": m["mes"].strftime("%Y-%m"), "kg": m["kg"], "donaciones": m["donaciones"]} for m in por_mes],
        "supuestos": {"kg_por_racion": kg_por_racion},
    }
