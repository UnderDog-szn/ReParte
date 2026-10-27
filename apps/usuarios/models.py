from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models import Q


class UsuarioManager(BaseUserManager):
    """Manager que usa el correo como identificador en lugar del username."""

    use_in_migrations = True

    def _crear(self, email, password, **extra):
        if not email:
            raise ValueError("El correo es obligatorio")
        usuario = self.model(email=self.normalize_email(email), **extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._crear(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("rol", Usuario.Rol.ADMIN)
        return self._crear(email, password, **extra)


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        DONANTE = "DONANTE", "Donante"
        RECEPTOR = "RECEPTOR", "Receptor"
        VOLUNTARIO = "VOLUNTARIO", "Voluntario"
        ADMIN = "ADMIN", "Administrador"

    username = None
    email = models.EmailField("correo", unique=True)
    telefono = models.CharField(max_length=20, blank=True)
    rol = models.CharField(max_length=12, choices=Rol.choices, default=Rol.VOLUNTARIO)
    organizacion = models.ForeignKey(
        "organizaciones.Organizacion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="miembros",
        help_text="Solo para donantes y receptores.",
    )
    acepta_politica_datos_en = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UsuarioManager()

    def __str__(self):
        return f"{self.email} ({self.rol})"


class PerfilVoluntario(models.Model):
    class Vehiculo(models.TextChoices):
        A_PIE = "A_PIE", "A pie"
        BICICLETA = "BICICLETA", "Bicicleta"
        MOTO = "MOTO", "Moto"
        CARRO = "CARRO", "Carro"
        CAMIONETA = "CAMIONETA", "Camioneta"

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True, related_name="perfil_voluntario")
    region = models.ForeignKey("organizaciones.Region", on_delete=models.PROTECT, related_name="voluntarios")
    tipo_vehiculo = models.CharField(max_length=10, choices=Vehiculo.choices)
    capacidad_kg = models.DecimalField(max_digits=7, decimal_places=2)
    tiene_cava_frio = models.BooleanField(default=False)
    disponible = models.BooleanField(default=True)
    latitud = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    ubicacion_actualizada_en = models.DateTimeField(null=True, blank=True)
    recogidas_completadas = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "perfil de voluntario"
        verbose_name_plural = "perfiles de voluntarios"
        constraints = [models.CheckConstraint(condition=Q(capacidad_kg__gt=0), name="voluntario_capacidad_positiva")]

    def __str__(self):
        return f"{self.usuario.get_full_name() or self.usuario.email} · {self.get_tipo_vehiculo_display()}"


class Notificacion(models.Model):
    """En la simulación no se envía nada: se guarda aquí y se imprime en consola."""

    class Canal(models.TextChoices):
        APP = "APP", "En la app"
        PUSH = "PUSH", "Push"
        CORREO = "CORREO", "Correo"

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name="notificaciones")
    tipo = models.CharField(max_length=30)
    titulo = models.CharField(max_length=120)
    mensaje = models.TextField()
    canal = models.CharField(max_length=10, choices=Canal.choices, default=Canal.APP)
    donacion = models.ForeignKey(
        "donaciones.Donacion", on_delete=models.SET_NULL, null=True, blank=True, related_name="notificaciones"
    )
    leida = models.BooleanField(default=False)
    enviada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "notificación"
        verbose_name_plural = "notificaciones"
        ordering = ["-enviada_en"]
        indexes = [models.Index(fields=["usuario", "leida"])]

    def __str__(self):
        return f"{self.titulo} → {self.usuario.email}"
