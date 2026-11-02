from django.contrib import admin

from .models import Calificacion, CategoriaAlimento, Donacion, FotoDonacion, PublicacionRecurrente


@admin.register(CategoriaAlimento)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "es_perecedero", "requiere_frio", "activa"]


class FotoInline(admin.TabularInline):
    model = FotoDonacion
    extra = 0


@admin.register(Donacion)
class DonacionAdmin(admin.ModelAdmin):
    list_display = ["codigo", "descripcion", "donante", "categoria", "peso_estimado_kg", "estado", "fecha_limite_consumo"]
    list_filter = ["estado", "categoria", "condicion", "donante__region"]
    search_fields = ["codigo", "descripcion", "donante__razon_social"]
    readonly_fields = ["codigo", "creado_en", "actualizado_en"]
    inlines = [FotoInline]


@admin.register(Calificacion)
class CalificacionAdmin(admin.ModelAdmin):
    list_display = ["donacion", "calidad_alimento", "servicio_voluntario", "creado_en"]


@admin.register(PublicacionRecurrente)
class RecurrenteAdmin(admin.ModelAdmin):
    list_display = ["descripcion", "donante", "dias_semana", "hora_publicacion", "activa", "ultima_publicacion"]
