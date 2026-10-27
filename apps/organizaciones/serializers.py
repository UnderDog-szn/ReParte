from rest_framework import serializers

from .models import CapacidadReceptor, HorarioRecepcion, Organizacion, Region


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["id", "nombre", "departamento", "latitud", "longitud", "radio_busqueda_km",
                  "peso_distancia", "peso_urgencia", "peso_necesidad", "peso_equidad", "minutos_para_aceptar"]


class OrganizacionBreveSerializer(serializers.ModelSerializer):
    categoria_display = serializers.CharField(source="get_categoria_display", read_only=True)

    class Meta:
        model = Organizacion
        fields = ["id", "razon_social", "tipo", "categoria", "categoria_display", "direccion", "latitud", "longitud"]


class CapacidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapacidadReceptor
        exclude = ["organizacion"]


class HorarioSerializer(serializers.ModelSerializer):
    dia = serializers.CharField(source="get_dia_semana_display", read_only=True)

    class Meta:
        model = HorarioRecepcion
        fields = ["dia_semana", "dia", "hora_inicio", "hora_fin"]


class OrganizacionDetalleSerializer(OrganizacionBreveSerializer):
    region = RegionSerializer(read_only=True)
    capacidad = CapacidadSerializer(read_only=True)
    horarios = HorarioSerializer(many=True, read_only=True)

    class Meta(OrganizacionBreveSerializer.Meta):
        fields = OrganizacionBreveSerializer.Meta.fields + [
            "nit", "telefono", "correo", "estado_verificacion", "region", "capacidad", "horarios"]
