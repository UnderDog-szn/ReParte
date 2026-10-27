from django.contrib import admin

from .models import CapacidadReceptor, HorarioRecepcion, Organizacion, Region


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ["nombre", "departamento", "radio_busqueda_km", "minutos_para_aceptar", "activa"]


class CapacidadInline(admin.StackedInline):
    model = CapacidadReceptor
    can_delete = False


class HorarioInline(admin.TabularInline):
    model = HorarioRecepcion
    extra = 0


@admin.register(Organizacion)
class OrganizacionAdmin(admin.ModelAdmin):
    list_display = ["razon_social", "tipo", "categoria", "region", "estado_verificacion"]
    list_filter = ["tipo", "categoria", "region", "estado_verificacion"]
    search_fields = ["razon_social", "nit"]
    inlines = [CapacidadInline, HorarioInline]
