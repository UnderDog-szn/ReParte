"""Serializadores pequeños solo para documentar los cuerpos de petición en Swagger."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers


class MotivoSerializer(serializers.Serializer):
    motivo = serializers.CharField(required=False, allow_blank=True)


class TemperaturaSerializer(serializers.Serializer):
    temperatura = serializers.DecimalField(max_digits=4, decimal_places=1, required=False, allow_null=True)


class CalificarSerializer(serializers.Serializer):
    calidad = serializers.IntegerField(min_value=1, max_value=5, help_text="Calidad del alimento recibido")
    servicio = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True,
                                        help_text="Servicio del voluntario")
    comentario = serializers.CharField(max_length=300, required=False, allow_blank=True)


class UbicacionSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lon = serializers.FloatField()


class VerificarSerializer(serializers.Serializer):
    aprobada = serializers.BooleanField()
    motivo = serializers.CharField(required=False, allow_blank=True)


class CodigoSerializer(serializers.Serializer):
    codigo = serializers.CharField(help_text="Código de 6 dígitos que muestra el receptor.")
    temperatura = serializers.DecimalField(max_digits=4, decimal_places=1, required=False, allow_null=True)


sin_cuerpo = extend_schema(request=None)
respuesta_objeto = extend_schema(responses=OpenApiTypes.OBJECT)
