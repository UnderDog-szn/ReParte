from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


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
    acepta_politica_datos_en = models.DateTimeField(null=True, blank=True)
    # La FK a Organizacion se agrega en el siguiente paso (modelos de BD).

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UsuarioManager()

    def __str__(self):
        return f"{self.email} ({self.rol})"
