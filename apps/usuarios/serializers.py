from rest_framework import serializers

from apps.organizaciones.serializers import OrganizacionBreveSerializer

from .models import Notificacion, PerfilVoluntario, Usuario


class PerfilVoluntarioSerializer(serializers.ModelSerializer):
    region = serializers.CharField(source="region.nombre", read_only=True)
    tipo_vehiculo_display = serializers.CharField(source="get_tipo_vehiculo_display", read_only=True)

    class Meta:
        model = PerfilVoluntario
        fields = ["region", "tipo_vehiculo", "tipo_vehiculo_display", "capacidad_kg", "tiene_cava_frio",
                  "disponible", "recogidas_completadas"]


class YoSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="get_full_name", read_only=True)
    organizacion = OrganizacionBreveSerializer(read_only=True)
    region = serializers.SerializerMethodField()
    perfil_voluntario = serializers.SerializerMethodField()
    notificaciones_sin_leer = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ["id", "email", "nombre", "rol", "organizacion", "region", "perfil_voluntario",
                  "notificaciones_sin_leer"]

    def get_region(self, u):
        if u.organizacion:
            return {"id": u.organizacion.region_id, "nombre": u.organizacion.region.nombre}
        if hasattr(u, "perfil_voluntario"):
            return {"id": u.perfil_voluntario.region_id, "nombre": u.perfil_voluntario.region.nombre}
        return None

    def get_perfil_voluntario(self, u):
        return PerfilVoluntarioSerializer(u.perfil_voluntario).data if hasattr(u, "perfil_voluntario") else None

    def get_notificaciones_sin_leer(self, u):
        return u.notificaciones.filter(leida=False).count()


class NotificacionSerializer(serializers.ModelSerializer):
    donacion_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Notificacion
        fields = ["id", "tipo", "titulo", "mensaje", "leida", "enviada_en", "donacion_id"]
