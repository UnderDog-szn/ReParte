from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class Asignacion(models.Model):
    """Cada intento de entregar una donación a un receptor."""

    class Estado(models.TextChoices):
        SUGERIDA = "SUGERIDA", "Sugerida"
        ACEPTADA = "ACEPTADA", "Aceptada"
        RECHAZADA = "RECHAZADA", "Rechazada"
        EXPIRADA = "EXPIRADA", "Expirada"

    donacion = models.ForeignKey("donaciones.Donacion", on_delete=models.CASCADE, related_name="asignaciones")
    receptor = models.ForeignKey(
        "organizaciones.Organizacion", on_delete=models.PROTECT, related_name="asignaciones_recibidas"
    )
    puntaje = models.DecimalField(
        max_digits=6, decimal_places=4, validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))]
    )
    distancia_km = models.DecimalField(max_digits=6, decimal_places=2)
    intento = models.PositiveSmallIntegerField(default=1)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.SUGERIDA)
    expira_en = models.DateTimeField()
    respondida_en = models.DateTimeField(null=True, blank=True)
    respondida_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    motivo_rechazo = models.CharField(max_length=200, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "asignación"
        verbose_name_plural = "asignaciones"
        ordering = ["donacion", "intento"]
        indexes = [
            models.Index(fields=["estado", "expira_en"]),
            models.Index(fields=["receptor", "estado"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["donacion", "receptor"], name="asignacion_unica_por_receptor"),
            models.UniqueConstraint(
                fields=["donacion"], condition=Q(estado="ACEPTADA"), name="una_aceptada_por_donacion"
            ),
        ]

    def __str__(self):
        return f"{self.donacion.codigo} → {self.receptor.razon_social} ({self.get_estado_display()})"
