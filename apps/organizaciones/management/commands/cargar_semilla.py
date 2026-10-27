"""
Carga datos de prueba para la simulación de ReParte.

Uso:
    python manage.py cargar_semilla              # carga si la base está vacía
    python manage.py cargar_semilla --reiniciar  # borra los datos de prueba y los vuelve a crear

Todas las organizaciones y personas son ficticias. Contraseña de todos los usuarios: ReParte2026!
"""
import hashlib
import random
from datetime import time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from apps.donaciones.models import CategoriaAlimento, Donacion
from apps.emparejamiento.models import Asignacion
from apps.logistica.models import Certificado, Recogida
from apps.organizaciones.geo import distancia_km
from apps.organizaciones.models import CapacidadReceptor, HorarioRecepcion, Organizacion, Region
from apps.usuarios.models import Notificacion, PerfilVoluntario, Usuario

CLAVE = "ReParte2026!"
DOMINIO = "reparte.test"

REGIONES = [
    # nombre, departamento, latitud, longitud
    ("Riohacha", "La Guajira", "11.544400", "-72.907200"),
    ("Valledupar", "Cesar", "10.463100", "-73.253200"),
]

CATEGORIAS = [
    # nombre, perecedero, requiere frío
    ("Frutas y verduras", True, False),
    ("Panadería", True, False),
    ("Lácteos", True, True),
    ("Carnes y pescados", True, True),
    ("Granos y cereales", False, False),
    ("Enlatados", False, False),
    ("Comidas preparadas", True, True),
    ("Bebidas", False, False),
]

DONANTES = [
    # usuario, razón social, categoría, región, lat, lon
    ("elahorro", "Supermercado El Ahorro", "SUPERMERCADO", "Riohacha", "11.541000", "-72.912000"),
    ("laespiga", "Panadería La Espiga Dorada", "PANADERIA", "Riohacha", "11.548000", "-72.901000"),
    ("sabordelmar", "Restaurante Sabor del Mar", "RESTAURANTE", "Riohacha", "11.550200", "-72.910500"),
    ("laeconomia", "Supermercado La Economía", "SUPERMERCADO", "Valledupar", "10.470000", "-73.250000"),
    ("elprogreso", "Plaza de Mercado El Progreso", "CENTRAL_ABASTOS", "Valledupar", "10.458000", "-73.244000"),
]

RECEPTORES = [
    # usuario, razón social, categoría, región, lat, lon, kg/día, refrigeración, personas, necesidad
    ("almendros", "Comedor Comunitario Los Almendros", "COMEDOR", "Riohacha", "11.536000", "-72.900000", 120, False, 300, 4),
    ("manosqueayudan", "Fundación Manos que Ayudan", "FUNDACION", "Riohacha", "11.530000", "-72.920000", 200, True, 450, 3),
    ("laesperanza", "Hogar de Paso La Esperanza", "HOGAR_PASO", "Riohacha", "11.560000", "-72.895000", 80, False, 120, 5),
    ("solidario", "Banco de Alimentos Solidario", "BANCO_ALIMENTOS", "Valledupar", "10.465000", "-73.260000", 500, True, 1200, 2),
    ("semillitas", "Comedor Infantil Semillitas", "COMEDOR", "Valledupar", "10.455000", "-73.248000", 90, True, 200, 5),
]

VOLUNTARIOS = [
    # usuario, nombre, apellido, región, vehículo, kg, cava de frío
    ("vol.andres", "Andrés", "Ospino", "Riohacha", "MOTO", 40, False),
    ("vol.laura", "Laura", "Brito", "Riohacha", "CARRO", 150, True),
    ("vol.jose", "José", "Iguarán", "Riohacha", "BICICLETA", 15, False),
    ("vol.maria", "María", "Fuentes", "Valledupar", "CAMIONETA", 400, True),
    ("vol.daniel", "Daniel", "Oñate", "Valledupar", "MOTO", 40, False),
    ("vol.sofia", "Sofía", "Daza", "Valledupar", "CARRO", 120, False),
]

# donante, categoría, descripción, kg, condición, estado
DONACIONES = [
    ("elahorro", "Frutas y verduras", "Tomate, cebolla y papa en buen estado", 40, "AMBIENTE", "PUBLICADA"),
    ("laespiga", "Panadería", "Pan del día y pandebono", 15, "AMBIENTE", "PUBLICADA"),
    ("sabordelmar", "Comidas preparadas", "Arroz con pescado, 30 porciones", 12, "REFRIGERADO", "SUGERIDA"),
    ("elahorro", "Lácteos", "Yogur y kumis próximos a vencer", 25, "REFRIGERADO", "ASIGNADA"),
    ("laeconomia", "Granos y cereales", "Arroz y lenteja en empaques golpeados", 60, "AMBIENTE", "PUBLICADA"),
    ("elprogreso", "Frutas y verduras", "Plátano, yuca y ahuyama", 120, "AMBIENTE", "PUBLICADA"),
    ("laeconomia", "Enlatados", "Atún y frijoles con etiqueta dañada", 30, "AMBIENTE", "CANCELADA"),
    ("laespiga", "Panadería", "Tortas y roscones del fin de semana", 10, "AMBIENTE", "VENCIDA"),
    ("elahorro", "Frutas y verduras", "Banano y mango maduros", 55, "AMBIENTE", "ENTREGADA"),
    ("sabordelmar", "Comidas preparadas", "Almuerzos del día, 50 porciones", 20, "REFRIGERADO", "ENTREGADA"),
    ("laeconomia", "Lácteos", "Leche y queso costeño", 45, "REFRIGERADO", "ENTREGADA"),
    ("elprogreso", "Frutas y verduras", "Tomate y pimentón", 90, "AMBIENTE", "ENTREGADA"),
    ("laespiga", "Panadería", "Pan tajado y mantecadas", 18, "AMBIENTE", "ENTREGADA"),
    ("laeconomia", "Granos y cereales", "Pasta y avena", 70, "AMBIENTE", "ENTREGADA"),
]


class Command(BaseCommand):
    help = "Carga datos de prueba (regiones, organizaciones, usuarios y donaciones) para la simulación."

    def add_arguments(self, parser):
        parser.add_argument("--reiniciar", action="store_true", help="Borra los datos de prueba antes de cargarlos.")

    @transaction.atomic
    def handle(self, *args, **opciones):
        if Region.objects.exists():
            if not opciones["reiniciar"]:
                self.stdout.write(self.style.WARNING("Ya hay datos. Usa --reiniciar para borrarlos y cargarlos de nuevo."))
                return
            self.borrar()

        random.seed(7)
        self.ahora = timezone.now()
        self.regiones = self.crear_regiones()
        self.categorias = self.crear_categorias()
        self.donantes = self.crear_donantes()
        self.receptores = self.crear_receptores()
        self.voluntarios = self.crear_voluntarios()
        self.crear_donaciones()

        self.stdout.write(self.style.SUCCESS("Datos de prueba cargados:"))
        for modelo in [Region, Organizacion, Usuario, PerfilVoluntario, CategoriaAlimento,
                       Donacion, Asignacion, Recogida, Certificado, Notificacion]:
            self.stdout.write(f"  {modelo._meta.verbose_name_plural:<25} {modelo.objects.count()}")
        self.stdout.write(f"\nUsuarios de prueba: <usuario>@{DOMINIO}  (ej. elahorro@{DOMINIO}, almendros@{DOMINIO}, vol.laura@{DOMINIO})")
        self.stdout.write(f"Contraseña de todos: {CLAVE}")

    # ------------------------------------------------------------------ borrar
    def borrar(self):
        Certificado.objects.all().delete()
        Recogida.objects.all().delete()
        Asignacion.objects.all().delete()
        Notificacion.objects.all().delete()
        Donacion.objects.all().delete()
        PerfilVoluntario.objects.all().delete()
        Usuario.objects.filter(email__endswith=f"@{DOMINIO}").delete()
        Usuario.objects.update(organizacion=None)
        Organizacion.objects.all().delete()
        CategoriaAlimento.objects.all().delete()
        Region.objects.all().delete()
        if connection.vendor == "sqlite":  # reinicia los id para que los códigos vuelvan a DON-000001
            tablas = [m._meta.db_table for m in (Region, Organizacion, CategoriaAlimento, Donacion,
                                                 Asignacion, Recogida, Certificado, Notificacion)]
            with connection.cursor() as cur:
                cur.execute(f"DELETE FROM sqlite_sequence WHERE name IN ({','.join(['%s'] * len(tablas))})", tablas)
        self.stdout.write("Datos anteriores borrados.")

    # ------------------------------------------------------------------ catálogos
    def crear_regiones(self):
        return {
            nombre: Region.objects.create(nombre=nombre, departamento=depto, latitud=Decimal(lat), longitud=Decimal(lon))
            for nombre, depto, lat, lon in REGIONES
        }

    def crear_categorias(self):
        return {
            nombre: CategoriaAlimento.objects.create(nombre=nombre, es_perecedero=per, requiere_frio=frio)
            for nombre, per, frio in CATEGORIAS
        }

    def crear_usuario(self, usuario, rol, nombre, apellido="", organizacion=None):
        return Usuario.objects.create_user(
            email=f"{usuario}@{DOMINIO}", password=CLAVE, rol=rol, first_name=nombre, last_name=apellido,
            organizacion=organizacion, telefono="+57 300 000 0000", acepta_politica_datos_en=self.ahora,
        )

    def crear_organizacion(self, n, usuario, razon, categoria, region, lat, lon, tipo):
        return Organizacion.objects.create(
            tipo=tipo, categoria=categoria, razon_social=razon, nit=f"900{n:06d}-1",
            direccion=f"Dirección de prueba {n}, {region}", latitud=Decimal(lat), longitud=Decimal(lon),
            telefono="+57 300 000 0000", correo=f"{usuario}@{DOMINIO}", region=self.regiones[region],
            estado_verificacion=Organizacion.Estado.VERIFICADA,
        )

    def crear_donantes(self):
        donantes = {}
        for n, (usuario, razon, cat, region, lat, lon) in enumerate(DONANTES, start=1):
            org = self.crear_organizacion(n, usuario, razon, cat, region, lat, lon, Organizacion.Tipo.DONANTE)
            self.crear_usuario(usuario, Usuario.Rol.DONANTE, razon.split()[0], organizacion=org)
            donantes[usuario] = org
        return donantes

    def crear_receptores(self):
        receptores = {}
        for n, (usuario, razon, cat, region, lat, lon, kg, frio, personas, necesidad) in enumerate(RECEPTORES, start=101):
            org = self.crear_organizacion(n, usuario, razon, cat, region, lat, lon, Organizacion.Tipo.RECEPTOR)
            CapacidadReceptor.objects.create(
                organizacion=org, capacidad_kg_dia=kg, tiene_refrigeracion=frio,
                personas_atendidas=personas, nivel_necesidad=necesidad,
            )
            for dia in range(6):  # lunes a sábado
                HorarioRecepcion.objects.create(organizacion=org, dia_semana=dia, hora_inicio=time(7), hora_fin=time(18))
            self.crear_usuario(usuario, Usuario.Rol.RECEPTOR, razon.split()[0], organizacion=org)
            receptores[usuario] = org
        return receptores

    def crear_voluntarios(self):
        voluntarios = []
        for usuario, nombre, apellido, region, vehiculo, kg, cava in VOLUNTARIOS:
            u = self.crear_usuario(usuario, Usuario.Rol.VOLUNTARIO, nombre, apellido)
            voluntarios.append(PerfilVoluntario.objects.create(
                usuario=u, region=self.regiones[region], tipo_vehiculo=vehiculo, capacidad_kg=kg, tiene_cava_frio=cava,
            ))
        return voluntarios

    # ------------------------------------------------------------------ donaciones
    def receptor_mas_cercano(self, donante, requiere_frio):
        candidatos = [
            r for r in self.receptores.values()
            if r.region_id == donante.region_id and (r.capacidad.tiene_refrigeracion or not requiere_frio)
        ]
        return min(candidatos, key=lambda r: distancia_km(donante.latitud, donante.longitud, r.latitud, r.longitud))

    def crear_asignacion(self, donacion, estado, hace):
        receptor = self.receptor_mas_cercano(donacion.donante, donacion.condicion != "AMBIENTE")
        km = distancia_km(donacion.latitud, donacion.longitud, receptor.latitud, receptor.longitud)
        creada = self.ahora - hace
        return Asignacion.objects.create(
            donacion=donacion, receptor=receptor, puntaje=Decimal(str(round(random.uniform(0.55, 0.9), 4))),
            distancia_km=Decimal(str(round(km, 2))), estado=estado,
            expira_en=creada + timedelta(minutes=20),
            respondida_en=None if estado == "SUGERIDA" else creada + timedelta(minutes=8),
            respondida_por=None if estado == "SUGERIDA" else receptor.miembros.first(),
        )

    def crear_donaciones(self):
        dias_entregadas = [85, 62, 41, 25, 12, 4]  # para tener historial en varios meses
        n_cert = 0
        for usuario, cat, desc, kg, condicion, estado in DONACIONES:
            donante = self.donantes[usuario]
            entregada = estado == "ENTREGADA"
            hace = timedelta(days=dias_entregadas.pop(0)) if entregada else timedelta(hours=random.randint(1, 5))
            if estado == "VENCIDA":
                hace = timedelta(days=3)
            creada = self.ahora - hace

            d = Donacion.objects.create(
                donante=donante, creado_por=donante.miembros.first(), categoria=self.categorias[cat],
                descripcion=desc, cantidad=kg, peso_estimado_kg=kg, condicion=condicion,
                fecha_limite_consumo=creada + timedelta(days=2),
                recogida_desde=creada + timedelta(hours=1), recogida_hasta=creada + timedelta(hours=4),
                estado="PUBLICADA" if estado == "SUGERIDA" else estado,
                motivo_cancelacion="El donante vendió el producto." if estado == "CANCELADA" else "",
            )
            Donacion.objects.filter(pk=d.pk).update(creado_en=creada)

            if estado == "SUGERIDA":
                a = self.crear_asignacion(d, "SUGERIDA", timedelta(minutes=5))
                a.expira_en = self.ahora + timedelta(minutes=15)
                a.save(update_fields=["expira_en"])
                Notificacion.objects.create(
                    usuario=a.receptor.miembros.first(), tipo="NUEVA_ASIGNACION", donacion=d,
                    titulo="Nueva donación sugerida", mensaje=f"{d.descripcion} de {donante.razon_social}. Tienes 15 min para aceptar.",
                )
            elif estado in ("ASIGNADA", "ENTREGADA"):
                a = self.crear_asignacion(d, "ACEPTADA", hace)
                voluntario = next(v for v in self.voluntarios if v.region_id == donante.region_id
                                  and (v.tiene_cava_frio or condicion == "AMBIENTE"))
                r = Recogida.objects.create(
                    donacion=d, asignacion=a, codigo_verificacion=f"{random.randint(0, 999999):06d}",
                    distancia_km=a.distancia_km,
                )
                if entregada:
                    r.voluntario = voluntario
                    r.estado = Recogida.Estado.ENTREGADA
                    r.tomada_en = creada + timedelta(minutes=30)
                    r.recogida_en = creada + timedelta(hours=1, minutes=20)
                    r.entregada_en = creada + timedelta(hours=2)
                    r.save()
                    voluntario.recogidas_completadas += 1
                    voluntario.save(update_fields=["recogidas_completadas"])
                    n_cert += 1
                    consecutivo = f"RP-{r.entregada_en.year}-{n_cert:06d}"
                    Certificado.objects.create(
                        donacion=d, consecutivo=consecutivo, kg_certificados=d.peso_estimado_kg,
                        hash_sha256=hashlib.sha256(f"{consecutivo}|{d.codigo}|{d.peso_estimado_kg}".encode()).hexdigest(),
                    )
