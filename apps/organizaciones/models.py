from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

PESO = [MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))]


class Region(models.Model):
    """Ciudad o zona donde opera ReParte. Guarda los pesos del algoritmo."""

    nombre = models.CharField(max_length=100, unique=True)
    departamento = models.CharField(max_length=100)
    pais = models.CharField(max_length=2, default="CO")
    latitud = models.DecimalField(max_digits=9, decimal_places=6)
    longitud = models.DecimalField(max_digits=9, decimal_places=6)
    radio_busqueda_km = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    peso_distancia = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.35"), validators=PESO)
    peso_urgencia = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.30"), validators=PESO)
    peso_necesidad = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.20"), validators=PESO)
    peso_equidad = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.15"), validators=PESO)
    minutos_para_aceptar = models.PositiveSmallIntegerField(default=20)
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "región"
        verbose_name_plural = "regiones"
        ordering = ["nombre"]

    def clean(self):
        total = self.peso_distancia + self.peso_urgencia + self.peso_necesidad + self.peso_equidad
        if total != Decimal("1.00"):
            raise ValidationError(f"Los cuatro pesos deben sumar 1 (suman {total}).")

    def __str__(self):
        return f"{self.nombre}, {self.departamento}"


class Organizacion(models.Model):
    class Tipo(models.TextChoices):
        DONANTE = "DONANTE", "Donante"
        RECEPTOR = "RECEPTOR", "Receptor"

    class Categoria(models.TextChoices):
        SUPERMERCADO = "SUPERMERCADO", "Supermercado"
        RESTAURANTE = "RESTAURANTE", "Restaurante"
        PANADERIA = "PANADERIA", "Panadería"
        PRODUCTOR = "PRODUCTOR", "Productor"
        CENTRAL_ABASTOS = "CENTRAL_ABASTOS", "Central de abastos"
        BANCO_ALIMENTOS = "BANCO_ALIMENTOS", "Banco de alimentos"
        COMEDOR = "COMEDOR", "Comedor comunitario"
        FUNDACION = "FUNDACION", "Fundación"
        HOGAR_PASO = "HOGAR_PASO", "Hogar de paso"
        OTRO = "OTRO", "Otro"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        VERIFICADA = "VERIFICADA", "Verificada"
        RECHAZADA = "RECHAZADA", "Rechazada"

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    categoria = models.CharField(max_length=20, choices=Categoria.choices)
    razon_social = models.CharField(max_length=200)
    nit = models.CharField("NIT", max_length=15, unique=True)
    direccion = models.CharField(max_length=250)
    latitud = models.DecimalField(max_digits=9, decimal_places=6)
    longitud = models.DecimalField(max_digits=9, decimal_places=6)
    telefono = models.CharField(max_length=20)
    correo = models.EmailField()
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="organizaciones")
    estado_verificacion = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    documento_soporte = models.FileField(upload_to="soportes/", blank=True, help_text="RUT o certificado de existencia")
    motivo_rechazo = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "organización"
        verbose_name_plural = "organizaciones"
        ordering = ["razon_social"]
        indexes = [models.Index(fields=["tipo", "estado_verificacion"])]

    @property
    def verificada(self):
        return self.estado_verificacion == self.Estado.VERIFICADA

    def __str__(self):
        return f"{self.razon_social} ({self.get_tipo_display()})"


class CapacidadReceptor(models.Model):
    organizacion = models.OneToOneField(
        Organizacion, on_delete=models.CASCADE, primary_key=True, related_name="capacidad"
    )
    capacidad_kg_dia = models.DecimalField(max_digits=8, decimal_places=2)
    acepta_perecederos = models.BooleanField(default=True)
    tiene_refrigeracion = models.BooleanField(default=False)
    tiene_congelacion = models.BooleanField(default=False)
    personas_atendidas = models.PositiveIntegerField(help_text="Personas atendidas por semana")
    nivel_necesidad = models.PositiveSmallIntegerField(
        default=3, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    radio_max_km = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "capacidad del receptor"
        verbose_name_plural = "capacidades de receptores"
        constraints = [
            models.CheckConstraint(condition=Q(capacidad_kg_dia__gt=0), name="capacidad_positiva"),
            models.CheckConstraint(
                condition=Q(nivel_necesidad__gte=1, nivel_necesidad__lte=5), name="nivel_necesidad_1_a_5"
            ),
        ]

    def clean(self):
        if self.organizacion_id and self.organizacion.tipo != Organizacion.Tipo.RECEPTOR:
            raise ValidationError("Solo las organizaciones receptoras tienen capacidad.")

    def __str__(self):
        return f"Capacidad de {self.organizacion.razon_social}"


class HorarioRecepcion(models.Model):
    class Dia(models.IntegerChoices):
        LUNES = 0, "Lunes"
        MARTES = 1, "Martes"
        MIERCOLES = 2, "Miércoles"
        JUEVES = 3, "Jueves"
        VIERNES = 4, "Viernes"
        SABADO = 5, "Sábado"
        DOMINGO = 6, "Domingo"

    organizacion = models.ForeignKey(Organizacion, on_delete=models.CASCADE, related_name="horarios")
    dia_semana = models.PositiveSmallIntegerField(choices=Dia.choices)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    class Meta:
        verbose_name = "horario de recepción"
        verbose_name_plural = "horarios de recepción"
        ordering = ["organizacion", "dia_semana", "hora_inicio"]
        constraints = [models.CheckConstraint(condition=Q(hora_fin__gt=F("hora_inicio")), name="horario_valido")]

    def __str__(self):
        return f"{self.get_dia_semana_display()} {self.hora_inicio:%H:%M}-{self.hora_fin:%H:%M}"
