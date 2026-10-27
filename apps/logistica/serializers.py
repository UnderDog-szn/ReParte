from rest_framework import serializers

from apps.organizaciones.geo import distancia_km
from apps.organizaciones.serializers import OrganizacionBreveSerializer

from .models import Certificado, Recogida


class RecogidaSerializer(serializers.ModelSerializer):
    codigo_donacion = serializers.CharField(source="donacion.codigo", read_only=True)
    descripcion = serializers.CharField(source="donacion.descripcion", read_only=True)
    categoria = serializers.CharField(source="donacion.categoria.nombre", read_only=True)
    peso_kg = serializers.DecimalField(source="donacion.peso_estimado_kg", max_digits=8, decimal_places=2, read_only=True)
    condicion = serializers.CharField(source="donacion.get_condicion_display", read_only=True)
    requiere_frio = serializers.SerializerMethodField()
    recogida_hasta = serializers.DateTimeField(source="donacion.recogida_hasta", read_only=True)
    origen = OrganizacionBreveSerializer(source="donacion.donante", read_only=True)
    destino = OrganizacionBreveSerializer(source="asignacion.receptor", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    distancia_a_origen_km = serializers.SerializerMethodField()

    class Meta:
        model = Recogida
        # El código de verificación NO se envía al voluntario: lo da el receptor al recibir.
        fields = ["id", "estado", "estado_display", "codigo_donacion", "descripcion", "categoria", "peso_kg",
                  "condicion", "requiere_frio", "recogida_hasta", "origen", "destino", "distancia_km",
                  "distancia_a_origen_km", "tomada_en", "recogida_en", "entregada_en"]

    def get_requiere_frio(self, r):
        return r.donacion.condicion != "AMBIENTE"

    def get_distancia_a_origen_km(self, r):
        perfil = self.context.get("perfil")
        if not (perfil and perfil.latitud is not None):
            return None
        d = r.donacion.donante
        return round(distancia_km(perfil.latitud, perfil.longitud, d.latitud, d.longitud), 2)


class CertificadoSerializer(serializers.ModelSerializer):
    codigo_donacion = serializers.CharField(source="donacion.codigo", read_only=True)
    descripcion = serializers.CharField(source="donacion.descripcion", read_only=True)
    receptor = serializers.SerializerMethodField()

    class Meta:
        model = Certificado
        fields = ["id", "consecutivo", "codigo_donacion", "descripcion", "receptor", "kg_certificados",
                  "hash_sha256", "emitido_en"]

    def get_receptor(self, c):
        r = getattr(c.donacion, "recogida", None)
        return r.asignacion.receptor.razon_social if r else None
