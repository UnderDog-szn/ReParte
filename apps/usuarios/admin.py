from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Notificacion, PerfilVoluntario, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ["email"]
    list_display = ["email", "first_name", "last_name", "rol", "organizacion", "is_active"]
    list_filter = ["rol", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("first_name", "last_name", "telefono", "rol", "organizacion")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "rol", "password1", "password2")}),)


@admin.register(PerfilVoluntario)
class PerfilVoluntarioAdmin(admin.ModelAdmin):
    list_display = ["usuario", "region", "tipo_vehiculo", "capacidad_kg", "tiene_cava_frio", "disponible"]
    list_filter = ["region", "tipo_vehiculo", "disponible"]


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ["titulo", "usuario", "tipo", "canal", "leida", "enviada_en"]
    list_filter = ["tipo", "leida"]
