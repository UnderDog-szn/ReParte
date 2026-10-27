from django.utils import timezone
from rest_framework import serializers

from apps.donaciones.serializers import DonacionListaSerializer

from .models import Asignacion


class AsignacionSerializer(serializers.ModelSerializer):
    donacion = DonacionListaSerializer(read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    segundos_restantes = serializers.SerializerMethodField()

    class Meta:
        model = Asignacion
        fields = ["id", "donacion", "puntaje", "distancia_km", "intento", "estado", "estado_display",
                  "expira_en", "segundos_restantes"]

    def get_segundos_restantes(self, a):
        return max(0, int((a.expira_en - timezone.now()).total_seconds()))
