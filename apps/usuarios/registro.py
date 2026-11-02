"""Registro de nuevas cuentas desde la app."""
from decimal import Decimal

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.organizaciones.models import CapacidadReceptor, HorarioRecepcion, Organizacion, Region
from apps.usuarios.services import notificar

from .models import PerfilVoluntario, Usuario


class RegistroSerializer(serializers.Serializer):
    rol = serializers.ChoiceField(choices=["DONANTE", "RECEPTOR", "VOLUNTARIO"])
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    telefono = serializers.CharField(max_length=20)
    acepta_politica = serializers.BooleanField()
    region = serializers.PrimaryKeyRelatedField(queryset=Region.objects.filter(activa=True))
    # Organización (donante y receptor)
    razon_social = serializers.CharField(max_length=200, required=False)
    nit = serializers.CharField(max_length=15, required=False)
    categoria = serializers.ChoiceField(choices=Organizacion.Categoria.choices, required=False)
    direccion = serializers.CharField(max_length=250, required=False)
    latitud = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitud = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    documento_soporte = serializers.FileField(required=False)
    # Receptor
    capacidad_kg_dia = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)
    personas_atendidas = serializers.IntegerField(required=False, min_value=0)
    tiene_refrigeracion = serializers.BooleanField(required=False, default=False)
    # Voluntario
    tipo_vehiculo = serializers.ChoiceField(choices=PerfilVoluntario.Vehiculo.choices, required=False)
    capacidad_kg = serializers.DecimalField(max_digits=7, decimal_places=2, required=False)
    tiene_cava_frio = serializers.BooleanField(required=False, default=False)

    def validate_email(self, v):
        if Usuario.objects.filter(email__iexact=v).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return v.lower()

    def validate_nit(self, v):
        if Organizacion.objects.filter(nit=v).exists():
            raise serializers.ValidationError("Ya hay una organización registrada con este NIT.")
        return v

    def validate(self, d):
        e = {}
        if not d.get("acepta_politica"):
            e["acepta_politica"] = "Debes autorizar el tratamiento de datos (Ley 1581 de 2012)."
        try:
            validate_password(d["password"])
        except Exception as ex:  # noqa: BLE001
            e["password"] = list(getattr(ex, "messages", [str(ex)]))
        if d["rol"] in ("DONANTE", "RECEPTOR"):
            for c in ("razon_social", "nit", "categoria", "direccion", "latitud", "longitud"):
                if d.get(c) in (None, ""):
                    e[c] = "Este campo es obligatorio para organizaciones."
        if d["rol"] == "RECEPTOR" and not d.get("capacidad_kg_dia"):
            e["capacidad_kg_dia"] = "Indica cuántos kg puedes recibir por día."
        if d["rol"] == "VOLUNTARIO":
            for c in ("tipo_vehiculo", "capacidad_kg"):
                if not d.get(c):
                    e[c] = "Este campo es obligatorio para voluntarios."
        if e:
            raise serializers.ValidationError(e)
        return d

    @transaction.atomic
    def create(self, d):
        org = None
        if d["rol"] in ("DONANTE", "RECEPTOR"):
            org = Organizacion.objects.create(
                tipo=d["rol"], categoria=d["categoria"], razon_social=d["razon_social"], nit=d["nit"],
                direccion=d["direccion"], latitud=d["latitud"], longitud=d["longitud"], telefono=d["telefono"],
                correo=d["email"], region=d["region"], documento_soporte=d.get("documento_soporte") or "",
            )
            if d["rol"] == "RECEPTOR":
                cap = CapacidadReceptor.objects.create(
                    organizacion=org, capacidad_kg_dia=d["capacidad_kg_dia"],
                    personas_atendidas=d.get("personas_atendidas") or 0,
                    tiene_refrigeracion=d.get("tiene_refrigeracion", False),
                )
                from datetime import time
                for dia in range(6):
                    HorarioRecepcion.objects.create(organizacion=org, dia_semana=dia, hora_inicio=time(8), hora_fin=time(17))
                cap.save()
        usuario = Usuario.objects.create_user(
            email=d["email"], password=d["password"], rol=d["rol"], first_name=d["first_name"],
            last_name=d.get("last_name", ""), telefono=d["telefono"], organizacion=org,
            acepta_politica_datos_en=timezone.now(),
        )
        if d["rol"] == "VOLUNTARIO":
            PerfilVoluntario.objects.create(usuario=usuario, region=d["region"], tipo_vehiculo=d["tipo_vehiculo"],
                                            capacidad_kg=d["capacidad_kg"] or Decimal("1"),
                                            tiene_cava_frio=d.get("tiene_cava_frio", False))
        if org:
            admins = Usuario.objects.filter(rol=Usuario.Rol.ADMIN)
            notificar(admins, "NUEVA_ORGANIZACION", "Nueva organización por verificar",
                      f"{org.razon_social} ({org.get_tipo_display()}) se registró en {org.region.nombre}.")
        return usuario
