from django.db import models


class Recogida(models.Model):
    class Estado(models.TextChoices):
        DISPONIBLE = "DISPONIBLE", "Disponible"
        TOMADA = "TOMADA", "Tomada"
        RECOGIDA = "RECOGIDA", "Recogida"
        ENTREGADA = "ENTREGADA", "Entregada"
        CANCELADA = "CANCELADA", "Cancelada"

    donacion = models.OneToOneField("donaciones.Donacion", on_delete=models.CASCADE, related_name="recogida")
    asignacion = models.OneToOneField(
        "emparejamiento.Asignacion", on_delete=models.PROTECT, related_name="recogida"
    )
    voluntario = models.ForeignKey(
        "usuarios.PerfilVoluntario", on_delete=models.PROTECT, null=True, blank=True, related_name="recogidas"
    )
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.DISPONIBLE)
    codigo_verificacion = models.CharField(max_length=6)
    tomada_en = models.DateTimeField(null=True, blank=True)
    recogida_en = models.DateTimeField(null=True, blank=True)
    entregada_en = models.DateTimeField(null=True, blank=True)
    temperatura_recogida = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    temperatura_entrega = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    distancia_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        verbose_name = "recogida"
        verbose_name_plural = "recogidas"
        indexes = [models.Index(fields=["estado"])]

    def __str__(self):
        return f"Recogida {self.donacion.codigo} ({self.get_estado_display()})"


class Certificado(models.Model):
    """En la simulación no se genera el PDF: se guarda el consecutivo y el hash."""

    donacion = models.OneToOneField("donaciones.Donacion", on_delete=models.PROTECT, related_name="certificado")
    consecutivo = models.CharField(max_length=20, unique=True)
    kg_certificados = models.DecimalField(max_digits=8, decimal_places=2)
    hash_sha256 = models.CharField(max_length=64)
    emitido_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "certificado"
        verbose_name_plural = "certificados"
        ordering = ["-emitido_en"]

    def __str__(self):
        return self.consecutivo
