from decimal import Decimal

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
        fields = ["id", "razon_social", "tipo", "categoria", "categoria_display", "direccion", "latitud", "longitud",
                  "estado_verificacion", "motivo_rechazo"]


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
            "nit", "telefono", "correo", "region", "capacidad", "horarios", "documento", "contacto", "creado_en"]

    documento = serializers.SerializerMethodField()
    contacto = serializers.SerializerMethodField()

    def get_documento(self, o):
        return o.documento_soporte.url if o.documento_soporte else None

    def get_contacto(self, o):
        u = o.miembros.first()
        return {"nombre": u.get_full_name(), "email": u.email, "telefono": u.telefono} if u else None


class HorarioEditarSerializer(serializers.Serializer):
    dia_semana = serializers.IntegerField(min_value=0, max_value=6)
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()


class CapacidadEditarSerializer(serializers.Serializer):
    capacidad_kg_dia = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal("0.1"), required=False)
    personas_atendidas = serializers.IntegerField(min_value=0, required=False)
    acepta_perecederos = serializers.BooleanField(required=False)
    tiene_refrigeracion = serializers.BooleanField(required=False)
    tiene_congelacion = serializers.BooleanField(required=False)
    radio_max_km = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0.5"), required=False)
    horarios = HorarioEditarSerializer(many=True, required=False)
