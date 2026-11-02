"""
Algoritmo de emparejamiento.

puntaje = w1·proximidad + w2·urgencia + w3·necesidad + w4·equidad
Cada factor se normaliza entre 0 y 1; los pesos (w) están en la Región y suman 1.
"""
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.comun.excepciones import ErrorNegocio
from apps.donaciones.models import Donacion
from apps.donaciones.services import cambiar_estado, marcar_vencidas
from apps.organizaciones.geo import distancia_km
from apps.organizaciones.models import Organizacion
from apps.usuarios.services import notificar

from .models import Asignacion

HORAS_URGENCIA = 72  # una donación que vence en 72 h o más tiene urgencia 0


@dataclass
class Candidato:
    receptor: Organizacion
    distancia_km: float
    recibidas_7d: int = 0
    puntaje: float = 0.0
    factores: dict = field(default_factory=dict)


def calcular_puntaje(*, distancia_km, radio_km, horas_restantes, nivel_necesidad, recibidas_7d, max_recibidas, pesos):
    """Función pura (sin base de datos) para poder probarla fácilmente."""
    proximidad = max(0.0, 1 - float(distancia_km) / float(radio_km))
    urgencia = min(1.0, max(0.0, 1 - float(horas_restantes) / HORAS_URGENCIA))
    necesidad = nivel_necesidad / 5
    equidad = 1 - (recibidas_7d / max_recibidas) if max_recibidas else 1.0
    w1, w2, w3, w4 = (float(p) for p in pesos)
    total = w1 * proximidad + w2 * urgencia + w3 * necesidad + w4 * equidad
    factores = {"proximidad": proximidad, "urgencia": urgencia, "necesidad": necesidad, "equidad": equidad}
    return round(total, 4), {k: round(v, 4) for k, v in factores.items()}


def _horario_compatible(receptor, donacion):
    desde = timezone.localtime(donacion.recogida_desde)
    hasta = timezone.localtime(donacion.recogida_hasta)
    horarios = list(receptor.horarios.all())
    if not horarios:
        return True
    return any(
        h.dia_semana == desde.weekday() and h.hora_inicio < hasta.time() and h.hora_fin > desde.time()
        for h in horarios
    )


def compatibilidad(donacion, receptor):
    """
    Restricciones duras entre una donación y un receptor.
    Devuelve (es_compatible, motivo_si_no, distancia_km).
    """
    region = donacion.donante.region
    cap = getattr(receptor, "capacidad", None)
    km = distancia_km(donacion.latitud, donacion.longitud, receptor.latitud, receptor.longitud)
    if receptor.region_id != region.pk:
        return False, "Está en otra región.", km
    if cap is None:
        return False, "Tu organización no tiene capacidad registrada.", km
    if donacion.condicion != Donacion.Condicion.AMBIENTE and not (cap.tiene_refrigeracion or cap.tiene_congelacion):
        return False, "Requiere refrigeración y no tienes.", km
    if donacion.condicion == Donacion.Condicion.CONGELADO and not cap.tiene_congelacion:
        return False, "Requiere congelador y no tienes.", km
    if donacion.categoria.es_perecedero and not cap.acepta_perecederos:
        return False, "Es perecedero y no recibes perecederos.", km
    if donacion.peso_estimado_kg > cap.capacidad_kg_dia:
        return False, f"Supera tu capacidad diaria ({cap.capacidad_kg_dia} kg).", km
    if km > float(min(region.radio_busqueda_km, cap.radio_max_km)):
        return False, "Está fuera de tu radio de recepción.", km
    if settings.REPARTE.get("FILTRAR_POR_HORARIO", False) and not _horario_compatible(receptor, donacion):
        return False, "La ventana de recogida no coincide con tu horario.", km
    return True, "", km


def candidatos(donacion):
    """Receptores que cumplen las restricciones duras, con su distancia."""
    intentados = donacion.asignaciones.values_list("receptor_id", flat=True)
    receptores = (
        Organizacion.objects.filter(
            tipo=Organizacion.Tipo.RECEPTOR, estado_verificacion=Organizacion.Estado.VERIFICADA,
            region=donacion.donante.region, capacidad__isnull=False,
        )
        .exclude(pk__in=list(intentados))
        .select_related("capacidad")
        .prefetch_related("horarios")
    )
    hace_7_dias = timezone.now() - timedelta(days=7)
    recibidas = dict(
        Asignacion.objects.filter(estado=Asignacion.Estado.ACEPTADA, respondida_en__gte=hace_7_dias)
        .values_list("receptor").annotate(n=Count("id"))
    )
    lista = []
    for r in receptores:
        ok, _motivo, km = compatibilidad(donacion, r)
        if ok:
            lista.append(Candidato(receptor=r, distancia_km=km, recibidas_7d=recibidas.get(r.pk, 0)))
    return lista


def evaluar(donacion):
    """Calcula el puntaje de cada candidato y los devuelve ordenados de mejor a peor."""
    region = donacion.donante.region
    lista = candidatos(donacion)
    if not lista:
        return []
    max_rec = max(c.recibidas_7d for c in lista)
    horas = (donacion.fecha_limite_consumo - timezone.now()).total_seconds() / 3600
    pesos = (region.peso_distancia, region.peso_urgencia, region.peso_necesidad, region.peso_equidad)
    for c in lista:
        c.puntaje, c.factores = calcular_puntaje(
            distancia_km=c.distancia_km,
            radio_km=min(region.radio_busqueda_km, c.receptor.capacidad.radio_max_km),
            horas_restantes=horas, nivel_necesidad=c.receptor.capacidad.nivel_necesidad,
            recibidas_7d=c.recibidas_7d, max_recibidas=max_rec, pesos=pesos,
        )
    return sorted(lista, key=lambda c: c.puntaje, reverse=True)


@transaction.atomic
def asignar_siguiente(donacion):
    """Sugiere la donación al mejor receptor que aún no la haya recibido. Devuelve la Asignacion o None."""
    donacion = Donacion.objects.select_for_update().select_related("donante__region", "categoria").get(pk=donacion.pk)
    if donacion.estado != Donacion.Estado.PUBLICADA:
        return None
    if donacion.asignaciones.filter(estado=Asignacion.Estado.SUGERIDA).exists():
        return None

    ordenados = evaluar(donacion)
    if not ordenados:
        notificar(donacion.donante.miembros.all(), "SIN_CANDIDATOS", "Sin receptores disponibles",
                  f"Ningún receptor cercano puede recibir {donacion.codigo} por ahora. Sigue publicada.", donacion)
        return None

    mejor = ordenados[0]
    minutos = donacion.donante.region.minutos_para_aceptar
    asignacion = Asignacion.objects.create(
        donacion=donacion, receptor=mejor.receptor,
        puntaje=Decimal(str(min(mejor.puntaje, 1))), distancia_km=Decimal(str(round(mejor.distancia_km, 2))),
        intento=donacion.asignaciones.count() + 1,
        expira_en=timezone.now() + timedelta(minutes=minutos),
    )
    notificar(mejor.receptor.miembros.all(), "NUEVA_ASIGNACION", "Nueva donación sugerida",
              f"{donacion.descripcion} ({donacion.peso_estimado_kg} kg) de {donacion.donante.razon_social}. "
              f"Tienes {minutos} min para aceptar.", donacion)
    return asignacion


def _validar_receptor(asignacion, usuario):
    if usuario.organizacion_id != asignacion.receptor_id:
        raise ErrorNegocio("Esta asignación es de otra organización.")


@transaction.atomic
def aceptar_asignacion(asignacion, usuario):
    from apps.logistica.services import avisar_voluntarios, crear_recogida

    a = Asignacion.objects.select_for_update().select_related("donacion__donante").get(pk=asignacion.pk)
    _validar_receptor(a, usuario)
    if a.estado != Asignacion.Estado.SUGERIDA:
        raise ErrorNegocio("Esta asignación ya no está pendiente.")
    if a.expira_en < timezone.now():
        raise ErrorNegocio("El tiempo para aceptar ya venció.")

    a.estado = Asignacion.Estado.ACEPTADA
    a.respondida_en = timezone.now()
    a.respondida_por = usuario
    a.save(update_fields=["estado", "respondida_en", "respondida_por"])
    cambiar_estado(a.donacion, Donacion.Estado.ASIGNADA)
    recogida = crear_recogida(a)
    notificar(a.donacion.donante.miembros.all(), "DONACION_ACEPTADA", "Donación aceptada",
              f"{a.receptor.razon_social} aceptó {a.donacion.codigo}. Buscando voluntario.", a.donacion)
    avisar_voluntarios(recogida)
    return a


@transaction.atomic
def rechazar_asignacion(asignacion, usuario, motivo=""):
    a = Asignacion.objects.select_for_update().get(pk=asignacion.pk)
    _validar_receptor(a, usuario)
    if a.estado != Asignacion.Estado.SUGERIDA:
        raise ErrorNegocio("Esta asignación ya no está pendiente.")
    a.estado = Asignacion.Estado.RECHAZADA
    a.respondida_en = timezone.now()
    a.respondida_por = usuario
    a.motivo_rechazo = motivo[:200]
    a.save(update_fields=["estado", "respondida_en", "respondida_por", "motivo_rechazo"])
    siguiente = asignar_siguiente(a.donacion)
    return a, siguiente


def donaciones_disponibles(receptor):
    """Excedentes publicados en la región del receptor, con su compatibilidad, del más cercano al más lejano."""
    qs = (
        Donacion.objects.filter(
            estado=Donacion.Estado.PUBLICADA, donante__region=receptor.region,
            fecha_limite_consumo__gt=timezone.now(),
        )
        .select_related("donante__region", "categoria")
        .prefetch_related("asignaciones")
    )
    resultado = []
    for d in qs:
        ok, motivo, km = compatibilidad(d, receptor)
        sugerida = next((a for a in d.asignaciones.all() if a.estado == Asignacion.Estado.SUGERIDA), None)
        d.distancia_receptor_km = round(km, 2)
        d.compatible = ok
        d.motivo_no_compatible = motivo
        d.sugerida_a_mi = bool(sugerida and sugerida.receptor_id == receptor.pk)
        resultado.append(d)
    return sorted(resultado, key=lambda d: (not d.compatible, d.distancia_receptor_km))


@transaction.atomic
def solicitar_donacion(donacion, usuario):
    """
    El receptor elige directamente un excedente publicado (sin esperar al algoritmo).
    Queda aceptado de inmediato, se crea la recogida y se avisa a los voluntarios.
    Si la donación estaba sugerida a otro receptor, esa sugerencia se cierra.
    """
    from apps.logistica.services import avisar_voluntarios, crear_recogida

    receptor = usuario.organizacion
    if not receptor or receptor.tipo != Organizacion.Tipo.RECEPTOR or not receptor.verificada:
        raise ErrorNegocio("Solo una organización receptora verificada puede solicitar excedentes.")
    d = Donacion.objects.select_for_update().select_related("donante__region", "categoria").get(pk=donacion.pk)
    if d.estado != Donacion.Estado.PUBLICADA:
        raise ErrorNegocio("Este excedente ya no está disponible.")
    if d.fecha_limite_consumo <= timezone.now():
        raise ErrorNegocio("Este excedente ya venció.")
    ok, motivo, km = compatibilidad(d, receptor)
    if not ok:
        raise ErrorNegocio(f"No puedes recibir este excedente: {motivo}")

    ahora = timezone.now()
    for otra in d.asignaciones.filter(estado=Asignacion.Estado.SUGERIDA).exclude(receptor=receptor).select_related("receptor"):
        otra.estado = Asignacion.Estado.EXPIRADA
        otra.motivo_rechazo = "Otro receptor la solicitó primero."
        otra.save(update_fields=["estado", "motivo_rechazo"])
        notificar(otra.receptor.miembros.all(), "SUGERENCIA_RETIRADA", "Sugerencia retirada",
                  f"{d.codigo} fue solicitada por otra organización.", d)

    a = d.asignaciones.filter(receptor=receptor).first()  # puede existir un intento anterior
    if a is None:
        a = Asignacion(donacion=d, receptor=receptor, intento=d.asignaciones.count() + 1)
    a.origen = Asignacion.Origen.SOLICITUD
    a.puntaje = Decimal("0")
    a.distancia_km = Decimal(str(round(km, 2)))
    a.estado = Asignacion.Estado.ACEPTADA
    a.expira_en = ahora
    a.respondida_en = ahora
    a.respondida_por = usuario
    a.motivo_rechazo = ""
    a.save()

    cambiar_estado(d, Donacion.Estado.ASIGNADA)
    recogida = crear_recogida(a)
    notificar(d.donante.miembros.all(), "DONACION_SOLICITADA", "Tu excedente fue solicitado",
              f"{receptor.razon_social} solicitó {d.codigo}. Buscando voluntario.", d)
    avisar_voluntarios(recogida)
    return a


def expirar_asignaciones():
    """Las sugerencias sin respuesta a tiempo pasan a EXPIRADA y se reasignan. Devuelve cuántas."""
    vencidas = Asignacion.objects.filter(estado=Asignacion.Estado.SUGERIDA, expira_en__lt=timezone.now())
    n = 0
    for a in vencidas.select_related("donacion"):
        a.estado = Asignacion.Estado.EXPIRADA
        a.save(update_fields=["estado"])
        asignar_siguiente(a.donacion)
        n += 1
    return n


def procesar_vencimientos():
    """
    Hace el trabajo que en producción haría Celery Beat cada minuto.
    En la simulación se llama al consultar listados y desde /api/simulacion/procesar/.
    """
    from apps.donaciones.services import generar_recurrentes

    return {"asignaciones_expiradas": expirar_asignaciones(), "donaciones_vencidas": marcar_vencidas(),
            "recurrentes_publicadas": generar_recurrentes()}
