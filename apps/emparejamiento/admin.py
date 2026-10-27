from django.contrib import admin

from .models import Asignacion


@admin.register(Asignacion)
class AsignacionAdmin(admin.ModelAdmin):
    list_display = ["donacion", "receptor", "intento", "puntaje", "distancia_km", "estado", "expira_en"]
    list_filter = ["estado"]
