from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


class ErrorNegocio(APIException):
    """Una regla del negocio impide la operación (por ejemplo, aceptar una asignación vencida)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "La operación no es válida en el estado actual."
    default_code = "regla_negocio"


def manejador_errores(exc, context):
    """Da a todos los errores de la API el mismo formato: {"error": ..., "detalle": ...}."""
    respuesta = exception_handler(exc, context)
    if respuesta is None:
        return None
    if isinstance(exc, ValidationError):
        respuesta.data = {"error": "validacion", "detalle": respuesta.data}
    else:
        codigo = getattr(exc, "default_code", "error")
        detalle = respuesta.data.get("detail", respuesta.data) if isinstance(respuesta.data, dict) else respuesta.data
        respuesta.data = {"error": codigo, "detalle": detalle}
    return respuesta
