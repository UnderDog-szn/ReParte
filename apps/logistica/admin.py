from django.contrib import admin

from .models import Certificado, Recogida


@admin.register(Recogida)
class RecogidaAdmin(admin.ModelAdmin):
    list_display = ["donacion", "voluntario", "estado", "codigo_verificacion", "entregada_en"]
    list_filter = ["estado"]


@admin.register(Certificado)
class CertificadoAdmin(admin.ModelAdmin):
    list_display = ["consecutivo", "donacion", "kg_certificados", "emitido_en"]
    readonly_fields = ["hash_sha256", "emitido_en"]
