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


# ---------------------------------------------------------------- fotos
TIPOS_IMAGEN = {"image/jpeg", "image/png", "image/webp"}
MAX_FOTO_BYTES = 5 * 1024 * 1024
MAX_FOTOS_POR_ETAPA = 4


def agregar_foto(donacion, usuario, archivo, etapa="PUBLICACION"):
    from .models import FotoDonacion

    if etapa not in FotoDonacion.Etapa.values:
        raise ErrorNegocio("Etapa de foto no válida.")
    es_donante = usuario.organizacion_id == donacion.donante_id
    recogida = getattr(donacion, "recogida", None)
    es_voluntario = bool(recogida and recogida.voluntario and recogida.voluntario.usuario_id == usuario.pk)
    es_receptor = bool(recogida and usuario.organizacion_id == recogida.asignacion.receptor_id)
    permitido = {"PUBLICACION": es_donante, "RECOGIDA": es_voluntario, "ENTREGA": es_voluntario or es_receptor}[etapa]
    if not permitido:
        raise ErrorNegocio("No puedes subir fotos en esta etapa de la donación.")
    if getattr(archivo, "content_type", "") not in TIPOS_IMAGEN:
        raise ErrorNegocio("La foto debe ser JPG, PNG o WEBP.")
    if archivo.size > MAX_FOTO_BYTES:
        raise ErrorNegocio("La foto no puede pesar más de 5 MB.")
    if donacion.fotos.filter(etapa=etapa).count() >= MAX_FOTOS_POR_ETAPA:
        raise ErrorNegocio(f"Máximo {MAX_FOTOS_POR_ETAPA} fotos por etapa.")
    return FotoDonacion.objects.create(donacion=donacion, etapa=etapa, imagen=archivo, subida_por=usuario)


# ---------------------------------------------------------------- calificación
def calificar_donacion(donacion, usuario, calidad, servicio=None, comentario=""):
    from .models import Calificacion

    recogida = getattr(donacion, "recogida", None)
    if not recogida or usuario.organizacion_id != recogida.asignacion.receptor_id:
        raise ErrorNegocio("Solo el receptor de esta donación puede calificarla.")
    if donacion.estado != Donacion.Estado.ENTREGADA:
        raise ErrorNegocio("Solo se califican donaciones entregadas.")
    if Calificacion.objects.filter(donacion=donacion).exists():
        raise ErrorNegocio("Esta donación ya fue calificada.")
    for valor in (calidad, servicio):
        if valor is not None and not (1 <= int(valor) <= 5):
            raise ErrorNegocio("Las calificaciones van de 1 a 5.")
    c = Calificacion.objects.create(donacion=donacion, calidad_alimento=int(calidad),
                                    servicio_voluntario=int(servicio) if servicio else None,
                                    comentario=(comentario or "")[:300], creado_por=usuario)
    notificar(donacion.donante.miembros.all(), "CALIFICACION", "Calificaron tu donación",
              f"{recogida.asignacion.receptor.razon_social} calificó {donacion.codigo} con {c.calidad_alimento}/5.", donacion)
    if recogida.voluntario and c.servicio_voluntario:
        notificar([recogida.voluntario.usuario], "CALIFICACION", "Te calificaron",
                  f"Tu entrega de {donacion.codigo} recibió {c.servicio_voluntario}/5. ¡Gracias!", donacion)
    return c


# ---------------------------------------------------------------- publicaciones recurrentes
def generar_recurrentes(ahora=None):
    """Publica las plantillas recurrentes que tocan hoy y cuya hora ya pasó. Devuelve cuántas publicó."""
    from datetime import datetime, timedelta

    from .models import PublicacionRecurrente

    ahora = timezone.localtime(ahora or timezone.now())
    hoy = ahora.date()
    n = 0
    pendientes = PublicacionRecurrente.objects.filter(activa=True).exclude(ultima_publicacion=hoy).select_related(
        "donante", "creado_por", "categoria")
    for r in pendientes:
        if ahora.weekday() not in r.dias or ahora.time() < r.hora_publicacion:
            continue
        if not r.donante.verificada:
            continue
        inicio = timezone.make_aware(datetime.combine(hoy, r.hora_publicacion))
        datos = {
            "categoria": r.categoria, "descripcion": r.descripcion, "cantidad": r.cantidad, "unidad": r.unidad,
            "peso_estimado_kg": r.peso_estimado_kg, "condicion": r.condicion,
            "recogida_desde": max(inicio, ahora), "recogida_hasta": max(inicio, ahora) + timedelta(hours=r.horas_para_recoger),
            "fecha_limite_consumo": max(inicio, ahora) + timedelta(hours=r.horas_vida_util),
        }
        r.ultima_publicacion = hoy
        r.save(update_fields=["ultima_publicacion"])
        publicar_donacion(r.creado_por, datos)
        n += 1
    return n
