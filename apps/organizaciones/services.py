from datetime import time

from django.db import transaction
from django.utils import timezone

from apps.comun.excepciones import ErrorNegocio
from apps.usuarios.services import notificar

from .models import CapacidadReceptor, HorarioRecepcion, Organizacion


@transaction.atomic
def verificar_organizacion(org, admin, aprobada, motivo=""):
    if org.estado_verificacion != Organizacion.Estado.PENDIENTE:
        raise ErrorNegocio("Esta organización ya fue revisada.")
    org.estado_verificacion = Organizacion.Estado.VERIFICADA if aprobada else Organizacion.Estado.RECHAZADA
    org.motivo_rechazo = "" if aprobada else (motivo or "No cumple los requisitos.")
    org.save(update_fields=["estado_verificacion", "motivo_rechazo", "actualizado_en"])
    titulo = "¡Tu organización fue verificada!" if aprobada else "Tu registro fue rechazado"
    mensaje = "Ya puedes usar ReParte." if aprobada else f"Motivo: {org.motivo_rechazo}"
    notificar(org.miembros.all(), "VERIFICACION", titulo, mensaje)
    return org


@transaction.atomic
def actualizar_capacidad(org, datos, horarios=None):
    """El receptor edita su capacidad y horarios. El nivel de necesidad solo lo cambia el administrador."""
    if org.tipo != Organizacion.Tipo.RECEPTOR:
        raise ErrorNegocio("Solo las organizaciones receptoras tienen capacidad.")
    cap, _ = CapacidadReceptor.objects.get_or_create(
        organizacion=org, defaults={"capacidad_kg_dia": 1, "personas_atendidas": 0})
    for campo in ("capacidad_kg_dia", "personas_atendidas", "acepta_perecederos", "tiene_refrigeracion",
                  "tiene_congelacion", "radio_max_km"):
        if campo in datos:
            setattr(cap, campo, datos[campo])
    if cap.capacidad_kg_dia <= 0:
        raise ErrorNegocio("La capacidad diaria debe ser mayor que cero.")
    cap.save()
    if horarios is not None:
        org.horarios.all().delete()
        for h in horarios:
            ini, fin = h["hora_inicio"], h["hora_fin"]
            if isinstance(ini, str):
                ini, fin = time.fromisoformat(ini), time.fromisoformat(fin)
            if fin <= ini:
                raise ErrorNegocio("En cada horario la hora final debe ser posterior a la inicial.")
            HorarioRecepcion.objects.create(organizacion=org, dia_semana=int(h["dia_semana"]), hora_inicio=ini, hora_fin=fin)
    org.actualizado_en = timezone.now()
    org.save(update_fields=["actualizado_en"])
    return cap
