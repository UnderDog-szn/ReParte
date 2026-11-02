from decimal import Decimal

from django.conf import settings
from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum
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
        calidad=Avg("donacion__calificacion__calidad_alimento"),
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
        "calificacion_promedio": round(tot["calidad"], 1) if tot["calidad"] else None,
        "por_mes": [{"mes": m["mes"].strftime("%Y-%m"), "kg": m["kg"], "donaciones": m["donaciones"]} for m in por_mes],
        "supuestos": {"kg_por_racion": kg_por_racion},
    }


INSIGNIAS_VOLUNTARIO = [(1, "Primera entrega"), (5, "5 entregas"), (10, "10 entregas"), (25, "Héroe del rescate")]
INSIGNIAS_DONANTE = [(50, "50 kg rescatados"), (100, "100 kg"), (500, "500 kg"), (1000, "Una tonelada")]


def _insignias(valor, tabla):
    return [nombre for umbral, nombre in tabla if valor >= umbral]


def ranking(region=None, limite=10):
    """Voluntarios con más entregas y donantes con más kilos rescatados."""
    qs = Recogida.objects.filter(estado=Recogida.Estado.ENTREGADA)
    if region:
        qs = qs.filter(donacion__donante__region=region)
    vols = (qs.filter(voluntario__isnull=False)
            .values("voluntario", "voluntario__usuario__first_name", "voluntario__usuario__last_name",
                    "voluntario__tipo_vehiculo", "voluntario__region__nombre")
            .annotate(entregas=Count("id"), kg=Sum("donacion__peso_estimado_kg")).order_by("-entregas", "-kg")[:limite])
    dons = (qs.values("donacion__donante", "donacion__donante__razon_social", "donacion__donante__region__nombre")
            .annotate(donaciones=Count("id"), kg=Sum("donacion__peso_estimado_kg")).order_by("-kg")[:limite])
    return {
        "voluntarios": [{
            "posicion": i + 1,
            "nombre": f"{v['voluntario__usuario__first_name']} {v['voluntario__usuario__last_name']}".strip(),
            "vehiculo": v["voluntario__tipo_vehiculo"], "region": v["voluntario__region__nombre"],
            "entregas": v["entregas"], "kg": v["kg"], "insignias": _insignias(v["entregas"], INSIGNIAS_VOLUNTARIO),
        } for i, v in enumerate(vols)],
        "donantes": [{
            "posicion": i + 1, "nombre": d["donacion__donante__razon_social"], "region": d["donacion__donante__region__nombre"],
            "donaciones": d["donaciones"], "kg": d["kg"], "insignias": _insignias(float(d["kg"] or 0), INSIGNIAS_DONANTE),
        } for i, d in enumerate(dons)],
    }
