import hashlib
import secrets

from django.db import transaction
from django.utils import timezone

from apps.comun.excepciones import ErrorNegocio
from apps.donaciones.models import Donacion
from apps.donaciones.services import cambiar_estado
from apps.usuarios.models import PerfilVoluntario
from apps.usuarios.services import notificar

from .models import Certificado, Recogida


def crear_recogida(asignacion):
    return Recogida.objects.create(
        donacion=asignacion.donacion, asignacion=asignacion,
        codigo_verificacion=f"{secrets.randbelow(10**6):06d}", distancia_km=asignacion.distancia_km,
    )


def _compatible(perfil, donacion):
    if donacion.peso_estimado_kg > perfil.capacidad_kg:
        return False
    if donacion.condicion != Donacion.Condicion.AMBIENTE and not perfil.tiene_cava_frio:
        return False
    return perfil.region_id == donacion.donante.region_id


def avisar_voluntarios(recogida):
    d = recogida.donacion
    perfiles = PerfilVoluntario.objects.filter(region=d.donante.region, disponible=True).select_related("usuario")
    destinatarios = [p.usuario for p in perfiles if _compatible(p, d)]
    notificar(destinatarios, "RECOGIDA_DISPONIBLE", "Nueva recogida cerca",
              f"{d.peso_estimado_kg} kg de {d.donante.razon_social} para {recogida.asignacion.receptor.razon_social}.", d)


def recogidas_disponibles(perfil):
    qs = Recogida.objects.filter(
        estado=Recogida.Estado.DISPONIBLE,
        donacion__donante__region=perfil.region,
        donacion__peso_estimado_kg__lte=perfil.capacidad_kg,
    ).select_related("donacion__donante", "donacion__categoria", "asignacion__receptor")
    if not perfil.tiene_cava_frio:
        qs = qs.filter(donacion__condicion=Donacion.Condicion.AMBIENTE)
    return qs


def recogida_activa(perfil):
    return (
        Recogida.objects.filter(voluntario=perfil, estado__in=[Recogida.Estado.TOMADA, Recogida.Estado.RECOGIDA])
        .select_related("donacion__donante", "donacion__categoria", "asignacion__receptor")
        .first()
    )


def _bloquear(recogida):
    return Recogida.objects.select_for_update().select_related(
        "donacion__donante", "asignacion__receptor", "voluntario__usuario"
    ).get(pk=recogida.pk)


def _validar_dueno(r, perfil):
    if r.voluntario_id != perfil.pk:
        raise ErrorNegocio("Esta recogida no está a tu nombre.")


@transaction.atomic
def tomar_recogida(recogida, perfil):
    r = _bloquear(recogida)
    if r.estado != Recogida.Estado.DISPONIBLE:
        raise ErrorNegocio("Otro voluntario ya tomó esta recogida.")
    if recogida_activa(perfil):
        raise ErrorNegocio("Ya tienes una recogida activa. Termínala antes de tomar otra.")
    if not _compatible(perfil, r.donacion):
        raise ErrorNegocio("Tu vehículo no es compatible con esta donación (peso o refrigeración).")
    r.voluntario = perfil
    r.estado = Recogida.Estado.TOMADA
    r.tomada_en = timezone.now()
    r.save(update_fields=["voluntario", "estado", "tomada_en"])
    cambiar_estado(r.donacion, Donacion.Estado.EN_RECOGIDA)
    nombre = perfil.usuario.get_full_name() or perfil.usuario.email
    notificar(list(r.donacion.donante.miembros.all()) + list(r.asignacion.receptor.miembros.all()),
              "VOLUNTARIO_ASIGNADO", "Voluntario en camino", f"{nombre} va a recoger {r.donacion.codigo}.", r.donacion)
    return r


@transaction.atomic
def registrar_recogida(recogida, perfil, temperatura=None):
    r = _bloquear(recogida)
    _validar_dueno(r, perfil)
    if r.estado != Recogida.Estado.TOMADA:
        raise ErrorNegocio("La recogida no está en el paso de recoger.")
    r.estado = Recogida.Estado.RECOGIDA
    r.recogida_en = timezone.now()
    r.temperatura_recogida = temperatura
    r.save(update_fields=["estado", "recogida_en", "temperatura_recogida"])
    cambiar_estado(r.donacion, Donacion.Estado.EN_TRANSITO)
    notificar(r.asignacion.receptor.miembros.all(), "EN_TRANSITO", "Donación en camino",
              f"{r.donacion.codigo} ya fue recogida. Ten listo el código de entrega.", r.donacion)
    return r


@transaction.atomic
def registrar_entrega(recogida, usuario, codigo, temperatura=None):
    r = _bloquear(recogida)
    es_voluntario = r.voluntario and r.voluntario.usuario_id == usuario.pk
    es_receptor = usuario.organizacion_id == r.asignacion.receptor_id
    if not (es_voluntario or es_receptor):
        raise ErrorNegocio("No participas en esta recogida.")
    if r.estado != Recogida.Estado.RECOGIDA:
        raise ErrorNegocio("Primero hay que registrar la recogida.")
    if str(codigo).strip() != r.codigo_verificacion:
        raise ErrorNegocio("El código de verificación no coincide.")

    r.estado = Recogida.Estado.ENTREGADA
    r.entregada_en = timezone.now()
    r.temperatura_entrega = temperatura
    r.save(update_fields=["estado", "entregada_en", "temperatura_entrega"])
    cambiar_estado(r.donacion, Donacion.Estado.ENTREGADA)
    if r.voluntario:
        r.voluntario.recogidas_completadas += 1
        r.voluntario.save(update_fields=["recogidas_completadas"])
    cert = emitir_certificado(r.donacion)
    notificar(r.donacion.donante.miembros.all(), "ENTREGA_CONFIRMADA", "¡Donación entregada!",
              f"{r.donacion.codigo} llegó a {r.asignacion.receptor.razon_social}. Certificado {cert.consecutivo}.",
              r.donacion)
    return r


@transaction.atomic
def liberar_recogida(recogida, perfil, motivo=""):
    """El voluntario desiste antes de recoger: la recogida vuelve a estar disponible."""
    r = _bloquear(recogida)
    _validar_dueno(r, perfil)
    if r.estado != Recogida.Estado.TOMADA:
        raise ErrorNegocio("Solo puedes liberar una recogida que aún no has recogido.")
    r.voluntario = None
    r.estado = Recogida.Estado.DISPONIBLE
    r.tomada_en = None
    r.observaciones = f"Liberada: {motivo}".strip()
    r.save(update_fields=["voluntario", "estado", "tomada_en", "observaciones"])
    cambiar_estado(r.donacion, Donacion.Estado.ASIGNADA)
    avisar_voluntarios(r)
    return r


def emitir_certificado(donacion):
    """Simulación: consecutivo + hash SHA-256. En producción se genera además el PDF."""
    anio = timezone.now().year
    ultimo = Certificado.objects.filter(consecutivo__startswith=f"RP-{anio}-").order_by("-consecutivo").first()
    n = int(ultimo.consecutivo.split("-")[-1]) + 1 if ultimo else 1
    consecutivo = f"RP-{anio}-{n:06d}"
    huella = hashlib.sha256(f"{consecutivo}|{donacion.codigo}|{donacion.peso_estimado_kg}".encode()).hexdigest()
    return Certificado.objects.create(
        donacion=donacion, consecutivo=consecutivo, kg_certificados=donacion.peso_estimado_kg, hash_sha256=huella
    )


# ---------------------------------------------------------------- seguimiento en vivo
def actualizar_ubicacion(recogida, perfil, lat, lon):
    """El voluntario comparte su posición solo mientras tiene una recogida activa."""
    if recogida.voluntario_id != perfil.pk or recogida.estado not in (Recogida.Estado.TOMADA, Recogida.Estado.RECOGIDA):
        raise ErrorNegocio("Solo se comparte la ubicación durante una recogida activa.")
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        raise ErrorNegocio("Ubicación no válida.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ErrorNegocio("Ubicación no válida.")
    perfil.latitud, perfil.longitud = round(lat, 6), round(lon, 6)
    perfil.ubicacion_actualizada_en = timezone.now()
    perfil.save(update_fields=["latitud", "longitud", "ubicacion_actualizada_en"])
    return perfil


def seguimiento(donacion, usuario):
    """Posición del voluntario para el donante, el receptor o el administrador."""
    recogida = getattr(donacion, "recogida", None)
    if not recogida:
        raise ErrorNegocio("Esta donación aún no tiene recogida.")
    es_admin = usuario.rol == "ADMIN" or usuario.is_superuser
    if not (es_admin or usuario.organizacion_id in (donacion.donante_id, recogida.asignacion.receptor_id)):
        raise ErrorNegocio("No participas en esta donación.")
    v = recogida.voluntario
    activa = recogida.estado in (Recogida.Estado.TOMADA, Recogida.Estado.RECOGIDA)
    org = lambda o: {"nombre": o.razon_social, "lat": float(o.latitud), "lon": float(o.longitud)}  # noqa: E731
    return {
        "estado": recogida.estado,
        "estado_display": recogida.get_estado_display(),
        "voluntario": (v.usuario.get_full_name() or v.usuario.email) if v else None,
        "vehiculo": v.get_tipo_vehiculo_display() if v else None,
        "posicion": {"lat": float(v.latitud), "lon": float(v.longitud), "actualizada_en": v.ubicacion_actualizada_en}
        if (v and activa and v.latitud is not None) else None,
        "origen": org(donacion.donante),
        "destino": org(recogida.asignacion.receptor),
    }
