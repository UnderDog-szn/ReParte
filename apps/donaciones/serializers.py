from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.organizaciones.serializers import OrganizacionBreveSerializer

from .models import CategoriaAlimento, Donacion, PublicacionRecurrente


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaAlimento
        fields = ["id", "nombre", "es_perecedero", "requiere_frio"]


def _asignacion_aceptada(donacion):
    for a in donacion.asignaciones.all():
        if a.estado == "ACEPTADA":
            return a
    return None


class DonacionListaSerializer(serializers.ModelSerializer):
    categoria = serializers.CharField(source="categoria.nombre", read_only=True)
    donante = OrganizacionBreveSerializer(read_only=True)
    receptor = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    condicion_display = serializers.CharField(source="get_condicion_display", read_only=True)
    unidad_display = serializers.CharField(source="get_unidad_display", read_only=True)
    codigo_entrega = serializers.SerializerMethodField()
    foto = serializers.SerializerMethodField()

    class Meta:
        model = Donacion
        fields = ["id", "codigo", "descripcion", "categoria", "foto", "cantidad", "unidad", "unidad_display",
                  "peso_estimado_kg", "condicion", "condicion_display", "estado", "estado_display",
                  "fecha_limite_consumo", "recogida_desde", "recogida_hasta", "latitud", "longitud",
                  "donante", "receptor", "codigo_entrega", "creado_en"]

    def get_receptor(self, d):
        a = _asignacion_aceptada(d)
        return OrganizacionBreveSerializer(a.receptor).data if a else None

    def get_foto(self, d):
        for f in d.fotos.all():
            if f.etapa == "PUBLICACION":
                return f.imagen.url
        return None

    def get_codigo_entrega(self, d):
        """Solo el receptor ve el código que debe darle al voluntario."""
        request = self.context.get("request")
        a = _asignacion_aceptada(d)
        if not (request and a and request.user.organizacion_id == a.receptor_id):
            return None
        recogida = getattr(d, "recogida", None)
        return recogida.codigo_verificacion if recogida else None


class DonacionDisponibleSerializer(DonacionListaSerializer):
    """Excedente visto por un receptor que está eligiendo qué solicitar."""

    distancia_km = serializers.FloatField(source="distancia_receptor_km", read_only=True)
    compatible = serializers.BooleanField(read_only=True)
    motivo_no_compatible = serializers.CharField(read_only=True)
    sugerida_a_mi = serializers.BooleanField(read_only=True)

    class Meta(DonacionListaSerializer.Meta):
        fields = DonacionListaSerializer.Meta.fields + ["distancia_km", "compatible", "motivo_no_compatible", "sugerida_a_mi"]


class DonacionDetalleSerializer(DonacionListaSerializer):
    asignaciones = serializers.SerializerMethodField()
    recogida = serializers.SerializerMethodField()
    certificado = serializers.SerializerMethodField()
    linea_tiempo = serializers.SerializerMethodField()
    fotos = serializers.SerializerMethodField()
    calificacion = serializers.SerializerMethodField()
    puede_calificar = serializers.SerializerMethodField()

    class Meta(DonacionListaSerializer.Meta):
        fields = DonacionListaSerializer.Meta.fields + [
            "motivo_cancelacion", "asignaciones", "recogida", "certificado", "linea_tiempo", "fotos",
            "calificacion", "puede_calificar"]

    def get_fotos(self, d):
        return [{"url": f.imagen.url, "etapa": f.etapa, "etapa_display": f.get_etapa_display()} for f in d.fotos.all()]

    def get_calificacion(self, d):
        c = getattr(d, "calificacion", None)
        return {"calidad_alimento": c.calidad_alimento, "servicio_voluntario": c.servicio_voluntario,
                "comentario": c.comentario, "creado_en": c.creado_en} if c else None

    def get_puede_calificar(self, d):
        request = self.context.get("request")
        r = getattr(d, "recogida", None)
        return bool(request and r and d.estado == "ENTREGADA" and not hasattr(d, "calificacion")
                    and request.user.organizacion_id == r.asignacion.receptor_id)

    def get_asignaciones(self, d):
        return [{"intento": a.intento, "receptor": a.receptor.razon_social, "puntaje": a.puntaje, "origen": a.origen,
                 "distancia_km": a.distancia_km, "estado": a.estado, "estado_display": a.get_estado_display(),
                 "motivo_rechazo": a.motivo_rechazo} for a in d.asignaciones.all()]

    def get_recogida(self, d):
        r = getattr(d, "recogida", None)
        if not r:
            return None
        v = r.voluntario
        return {"id": r.id, "estado": r.estado, "estado_display": r.get_estado_display(),
                "voluntario": (v.usuario.get_full_name() or v.usuario.email) if v else None,
                "vehiculo": v.get_tipo_vehiculo_display() if v else None, "distancia_km": r.distancia_km}

    def get_certificado(self, d):
        c = getattr(d, "certificado", None)
        return {"consecutivo": c.consecutivo, "kg": c.kg_certificados, "hash": c.hash_sha256,
                "emitido_en": c.emitido_en} if c else None

    def get_linea_tiempo(self, d):
        ev = [{"fecha": d.creado_en, "titulo": "Publicada", "detalle": f"por {d.donante.razon_social}"}]
        for a in d.asignaciones.all():
            if a.origen == "SOLICITUD":
                ev.append({"fecha": a.respondida_en, "titulo": f"Solicitada por {a.receptor.razon_social}",
                           "detalle": f"elegida directamente · {a.distancia_km} km"})
                continue
            ev.append({"fecha": a.creado_en, "titulo": f"Sugerida a {a.receptor.razon_social}",
                       "detalle": f"puntaje {a.puntaje} · {a.distancia_km} km"})
            if a.estado == "ACEPTADA":
                ev.append({"fecha": a.respondida_en, "titulo": "Aceptada", "detalle": a.receptor.razon_social})
            elif a.estado == "RECHAZADA":
                ev.append({"fecha": a.respondida_en, "titulo": "Rechazada",
                           "detalle": a.motivo_rechazo or a.receptor.razon_social})
            elif a.estado == "EXPIRADA":
                ev.append({"fecha": a.expira_en, "titulo": "Sin respuesta a tiempo", "detalle": a.receptor.razon_social})
        r = getattr(d, "recogida", None)
        if r and r.tomada_en and r.voluntario:
            ev.append({"fecha": r.tomada_en, "titulo": "Voluntario asignado",
                       "detalle": r.voluntario.usuario.get_full_name()})
        if r and r.recogida_en:
            ev.append({"fecha": r.recogida_en, "titulo": "Recogida", "detalle": "en camino al receptor"})
        if r and r.entregada_en:
            ev.append({"fecha": r.entregada_en, "titulo": "Entregada", "detalle": "confirmada con código"})
        c = getattr(d, "certificado", None)
        if c:
            ev.append({"fecha": c.emitido_en, "titulo": "Certificado emitido", "detalle": c.consecutivo})
        if d.estado in ("CANCELADA", "VENCIDA"):
            ev.append({"fecha": d.actualizado_en, "titulo": d.get_estado_display(), "detalle": d.motivo_cancelacion})
        return sorted(ev, key=lambda e: e["fecha"] or timezone.now())


class DonacionCrearSerializer(serializers.ModelSerializer):
    categoria = serializers.PrimaryKeyRelatedField(queryset=CategoriaAlimento.objects.filter(activa=True))
    peso_estimado_kg = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)

    class Meta:
        model = Donacion
        fields = ["categoria", "descripcion", "cantidad", "unidad", "peso_estimado_kg", "condicion",
                  "fecha_limite_consumo", "recogida_desde", "recogida_hasta"]

    def validate(self, datos):
        ahora = timezone.now()
        errores = {}
        if datos["cantidad"] <= 0:
            errores["cantidad"] = "Debe ser mayor que cero."
        if not datos.get("peso_estimado_kg"):
            if datos.get("unidad", "KG") == "KG":
                datos["peso_estimado_kg"] = datos["cantidad"]
            else:
                errores["peso_estimado_kg"] = "Indica el peso aproximado en kg."
        elif datos["peso_estimado_kg"] <= Decimal("0"):
            errores["peso_estimado_kg"] = "Debe ser mayor que cero."
        if datos["fecha_limite_consumo"] <= ahora:
            errores["fecha_limite_consumo"] = "Debe ser una fecha futura."
        if datos["recogida_hasta"] <= datos["recogida_desde"]:
            errores["recogida_hasta"] = "Debe ser posterior al inicio de la recogida."
        if datos["recogida_desde"] >= datos["fecha_limite_consumo"]:
            errores["recogida_desde"] = "La recogida debe empezar antes de la fecha límite."
        if errores:
            raise serializers.ValidationError(errores)
        return datos


class RecurrenteSerializer(serializers.ModelSerializer):
    categoria = serializers.PrimaryKeyRelatedField(queryset=CategoriaAlimento.objects.filter(activa=True))
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    dias = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6), write_only=True)
    dias_lista = serializers.ListField(source="dias", read_only=True)
    peso_estimado_kg = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)

    class Meta:
        model = PublicacionRecurrente
        fields = ["id", "categoria", "categoria_nombre", "descripcion", "cantidad", "unidad", "peso_estimado_kg",
                  "condicion", "dias", "dias_lista", "hora_publicacion", "horas_para_recoger", "horas_vida_util",
                  "activa", "ultima_publicacion"]
        read_only_fields = ["ultima_publicacion"]

    def validate(self, d):
        if "dias" in d:
            if not d["dias"]:
                raise serializers.ValidationError({"dias": "Elige al menos un día."})
            d["dias_semana"] = ",".join(str(x) for x in sorted(set(d.pop("dias"))))
        if d.get("cantidad") is not None and d["cantidad"] <= 0:
            raise serializers.ValidationError({"cantidad": "Debe ser mayor que cero."})
        if not d.get("peso_estimado_kg") and "cantidad" in d:
            if d.get("unidad", "KG") != "KG":
                raise serializers.ValidationError({"peso_estimado_kg": "Indica el peso aproximado en kg."})
            d["peso_estimado_kg"] = d["cantidad"]
        return d
