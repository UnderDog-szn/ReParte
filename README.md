# ReParte (simulación)

Plataforma para redistribuir excedentes de alimentos. Esta versión es una simulación
para el proyecto de Ingeniería de Software: Django + Django REST Framework con SQLite,
sin Docker, sin PostGIS, sin Redis ni Celery.

## Requisitos

- Python 3.10 o superior (`python --version`)
- Git (opcional)

## Levantar el ambiente en Windows (PowerShell)

```powershell
cd $HOME\Proyectos\ReParte
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py cargar_semilla
python manage.py runserver
```

`cargar_semilla` crea datos de prueba ficticios de Riohacha y Valledupar: 2 regiones, 5 donantes,
5 receptores, 6 voluntarios y 14 donaciones en distintos estados. Usuarios: `<usuario>@reparte.test`
(por ejemplo `elahorro@reparte.test`, `almendros@reparte.test`, `vol.laura@reparte.test`), contraseña
`ReParte2026!`. Para volver a empezar: `python manage.py cargar_semilla --reiniciar`.

Si PowerShell bloquea la activación del entorno, ejecuta una vez:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

En CMD la activación es `.venv\Scripts\activate.bat`.

## Verificar

| URL | Qué muestra |
|---|---|
| http://127.0.0.1:8000/api/salud/ | `{"estado": "ok"}` si el servidor está arriba |
| http://127.0.0.1:8000/api/docs/ | Documentación interactiva de la API (Swagger) |
| http://127.0.0.1:8000/admin/ | Panel de administración (usa el superusuario) |

Obtener un token JWT:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/auth/token/ `
  -ContentType "application/json" `
  -Body '{"email":"tu_correo","password":"tu_clave"}'
```

## Estructura

```
config/            settings, urls
apps/
  usuarios/        Usuario (correo + rol), PerfilVoluntario, Notificacion
  organizaciones/  Region, Organizacion, CapacidadReceptor, HorarioRecepcion, geo.py (Haversine)
  donaciones/      CategoriaAlimento, Donacion (estados y transiciones), FotoDonacion
  emparejamiento/  Asignacion                         (algoritmo: pendiente)
  logistica/       Recogida, Certificado              (servicios: pendiente)
  impacto/         Indicadores                        (pendiente)
```

## Diferencias con la versión final

| Final | Simulación |
|---|---|
| PostgreSQL + PostGIS | SQLite; distancias con la fórmula de Haversine en Python |
| Celery + Redis | Llamadas síncronas dentro de la misma petición |
| Firebase / correo | Notificaciones guardadas en la base de datos y mostradas en consola |
| Certificado PDF | Certificado con consecutivo y hash, sin PDF |
