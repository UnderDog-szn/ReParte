from django.conf import settings
from django.db import models
from django.db.models import F, Q


class CategoriaAlimento(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    es_perecedero = models.BooleanField()
    requiere_frio = models.BooleanField()
    factor_co2 = models.DecimalField(
        max_digits=6, decimal_places=3, default=0,
        help_text="kg de CO2 equivalente evitados por kg rescatado (valor de referencia a definir con fuentes).",
    )
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "categoría de alimento"
        verbose_name_plural = "categorías de alimento"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Donacion(models.Model):
    class Unidad(models.TextChoices):
        KG = "KG", "Kilogramos"
        UNIDAD = "UNIDAD", "Unidades"
        LITRO = "LITRO", "Litros"
        CAJA = "CAJA", "Cajas"

    class Condicion(models.TextChoices):
        AMBIENTE = "AMBIENTE", "Temperatura ambiente"
        REFRIGERADO = "REFRIGERADO", "Refrigerado"
        CONGELADO = "CONGELADO", "Congelado"

    class Estado(models.TextChoices):
        PUBLICADA = "PUBLICADA", "Publicada"
        ASIGNADA = "ASIGNADA", "Asignada"
        EN_RECOGIDA = "EN_RECOGIDA", "En recogida"
        EN_TRANSITO = "EN_TRANSITO", "En tránsito"
        ENTREGADA = "ENTREGADA", "Entregada"
        CANCELADA = "CANCELADA", "Cancelada"
        VENCIDA = "VENCIDA", "Vencida"

    # Transiciones permitidas: estado actual -> estados a los que puede pasar
    TRANSICIONES = {
        Estado.PUBLICADA: {Estado.ASIGNADA, Estado.CANCELADA, Estado.VENCIDA},
        Estado.ASIGNADA: {Estado.EN_RECOGIDA, Estado.PUBLICADA, Estado.CANCELADA},
        Estado.EN_RECOGIDA: {Estado.EN_TRANSITO, Estado.CANCELADA},
        Estado.EN_TRANSITO: {Estado.ENTREGADA},
        Estado.ENTREGADA: set(),
        Estado.CANCELADA: set(),
        Estado.VENCIDA: set(),
    }

    codigo = models.CharField(max_length=12, unique=True, editable=False)
    donante = models.ForeignKey(
        "organizaciones.Organizacion", on_delete=models.PROTECT, related_name="donaciones"
    )
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="donaciones_creadas")
    categoria = models.ForeignKey(CategoriaAlimento, on_delete=models.PROTECT, related_name="donaciones")
    descripcion = models.CharField(max_length=300)
    cantidad = models.DecimalField(max_digits=8, decimal_places=2)
    unidad = models.CharField(max_length=8, choices=Unidad.choices, default=Unidad.KG)
    peso_estimado_kg = models.DecimalField(max_digits=8, decimal_places=2)
    condicion = models.CharField(max_length=12, choices=Condicion.choices, default=Condicion.AMBIENTE)
    fecha_limite_consumo = models.DateTimeField()
    recogida_desde = models.DateTimeField()
    recogida_hasta = models.DateTimeField()
    latitud = models.DecimalField(max_digits=9, decimal_places=6)
    longitud = models.DecimalField(max_digits=9, decimal_places=6)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.PUBLICADA)
    motivo_cancelacion = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "donación"
        verbose_name_plural = "donaciones"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["estado", "fecha_limite_consumo"]),
            models.Index(fields=["donante", "creado_en"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(cantidad__gt=0), name="donacion_cantidad_positiva"),
            models.CheckConstraint(condition=Q(peso_estimado_kg__gt=0), name="donacion_peso_positivo"),
            models.CheckConstraint(condition=Q(recogida_hasta__gt=F("recogida_desde")), name="donacion_ventana_valida"),
        ]

    def save(self, *args, **kwargs):
        # Toma la ubicación del donante si no se indicó otra
        if self.latitud is None and self.donante_id:
            self.latitud, self.longitud = self.donante.latitud, self.donante.longitud
        super().save(*args, **kwargs)
        if not self.codigo:
            self.codigo = f"DON-{self.pk:06d}"
            super().save(update_fields=["codigo"])

    def puede_pasar_a(self, nuevo_estado):
        return nuevo_estado in self.TRANSICIONES[self.Estado(self.estado)]

    def __str__(self):
        return f"{self.codigo} · {self.descripcion[:40]} ({self.get_estado_display()})"


class FotoDonacion(models.Model):
    class Etapa(models.TextChoices):
        PUBLICACION = "PUBLICACION", "Publicación"
        RECOGIDA = "RECOGIDA", "Recogida"
        ENTREGA = "ENTREGA", "Entrega"

    donacion = models.ForeignKey(Donacion, on_delete=models.CASCADE, related_name="fotos")
    etapa = models.CharField(max_length=12, choices=Etapa.choices, default=Etapa.PUBLICACION)
    imagen = models.FileField(upload_to="donaciones/%Y/%m/")
    subida_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "foto de donación"
        verbose_name_plural = "fotos de donación"
