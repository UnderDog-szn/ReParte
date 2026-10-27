from django.db import transaction
from django.utils import timezone

from apps.comun.excepciones import ErrorNegocio
from apps.organizaciones.models import Organizacion
from apps.usuarios.services import notificar

from .models import Donacion


class TransicionInvalida(ErrorNegocio):
    default_code = "transicion_invalida"


def cambiar_estado(donacion, nuevo_estado):
    """Único punto del sistema que cambia el estado de una donación."""
    if not donacion.puede_pasar_a(nuevo_estado):
        raise TransicionInvalida(
            f"No se puede pasar de {donacion.get_estado_display()} a {Donacion.Estado(nuevo_estado).label}."
        )
    donacion.estado = nuevo_estado
    donacion.save(update_fields=["estado", "actualizado_en"])
    return donacion


def publicar_donacion(usuario, datos):
    """Crea la donación y lanza el emparejamiento (en producción sería una tarea de Celery)."""
    org = usuario.organizacion
    if not org or org.tipo != Organizacion.Tipo.DONANTE or not org.verificada:
        raise ErrorNegocio("Solo una organización donante verificada puede publicar.")
    with transaction.atomic():
        donacion = Donacion.objects.create(donante=org, creado_por=usuario, **datos)
    from apps.emparejamiento.services import asignar_siguiente

    asignar_siguiente(donacion)
    donacion.refresh_from_db()
    return donacion


@transaction.atomic
def cancelar_donacion(donacion, usuario, motivo=""):
    from apps.emparejamiento.models import Asignacion
    from apps.logistica.models import Recogida

    cambiar_estado(donacion, Donacion.Estado.CANCELADA)
    donacion.motivo_cancelacion = motivo or "Cancelada por el donante."
    donacion.save(update_fields=["motivo_cancelacion"])
    donacion.asignaciones.filter(estado=Asignacion.Estado.SUGERIDA).update(estado=Asignacion.Estado.EXPIRADA)

    aceptada = donacion.asignaciones.filter(estado=Asignacion.Estado.ACEPTADA).first()
    if aceptada:
        notificar(aceptada.receptor.miembros.all(), "DONACION_CANCELADA", "Donación cancelada",
                  f"{donacion.codigo} fue cancelada por el donante.", donacion)
    recogida = Recogida.objects.filter(donacion=donacion).first()
    if recogida and recogida.estado in (Recogida.Estado.DISPONIBLE, Recogida.Estado.TOMADA):
        recogida.estado = Recogida.Estado.CANCELADA
        recogida.save(update_fields=["estado"])
        if recogida.voluntario:
            notificar([recogida.voluntario.usuario], "RECOGIDA_CANCELADA", "Recogida cancelada",
                      f"La recogida de {donacion.codigo} fue cancelada.", donacion)
    return donacion


def marcar_vencidas():
    """Pasa a VENCIDA las donaciones publicadas cuya fecha límite ya pasó. Devuelve cuántas."""
    from apps.emparejamiento.models import Asignacion

    vencidas = Donacion.objects.filter(estado=Donacion.Estado.PUBLICADA, fecha_limite_consumo__lt=timezone.now())
    n = 0
    for d in vencidas:
        with transaction.atomic():
            d.asignaciones.filter(estado=Asignacion.Estado.SUGERIDA).update(estado=Asignacion.Estado.EXPIRADA)
            cambiar_estado(d, Donacion.Estado.VENCIDA)
            notificar(d.donante.miembros.all(), "DONACION_VENCIDA", "Donación vencida",
                      f"{d.codigo} venció sin ser recogida.", d)
        n += 1
    return n
