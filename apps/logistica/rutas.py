"""
Cálculo de rutas para el voluntario.

Usa OSRM (Open Source Routing Machine) sobre datos de OpenStreetMap. En la simulación se consulta el
servidor de demostración público; en producción se usaría un OSRM propio (ver guía de backend).
Si OSRM no responde, se devuelve una ruta aproximada en línea recta para que la app siga funcionando.
"""
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

from apps.organizaciones.geo import distancia_km

log = logging.getLogger(__name__)
VELOCIDAD_PROMEDIO_KMH = 25  # para estimar el tiempo cuando no hay OSRM


def calcular_ruta(puntos):
    """
    puntos: lista de dicts {"lat", "lon", "nombre", "tipo"} en el orden del recorrido.
    Devuelve distancia total, duración, tramos y la geometría como lista de [lat, lon].
    """
    puntos = [p for p in puntos if p.get("lat") is not None and p.get("lon") is not None]
    base = settings.REPARTE.get("OSRM_URL", "https://router.project-osrm.org").rstrip("/")
    coords = ";".join(f"{float(p['lon']):.6f},{float(p['lat']):.6f}" for p in puntos)
    url = f"{base}/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=false"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ReParte-simulacion/0.1 (proyecto academico)"})
        with urllib.request.urlopen(req, timeout=settings.REPARTE.get("OSRM_TIMEOUT", 6)) as r:
            datos = json.load(r)
        if datos.get("code") != "Ok" or not datos.get("routes"):
            raise ValueError(datos.get("message") or datos.get("code"))
        ruta = datos["routes"][0]
        return {
            "fuente": "osrm",
            "distancia_km": round(ruta["distance"] / 1000, 2),
            "duracion_min": round(ruta["duration"] / 60),
            "tramos": [{"desde": puntos[i]["nombre"], "hasta": puntos[i + 1]["nombre"],
                        "distancia_km": round(t["distance"] / 1000, 2), "duracion_min": round(t["duration"] / 60)}
                       for i, t in enumerate(ruta["legs"])],
            "geometria": [[lat, lon] for lon, lat in ruta["geometry"]["coordinates"]],
            "puntos": puntos,
        }
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, OSError) as e:
        log.warning("OSRM no disponible (%s); se usa línea recta.", e)
        return ruta_en_linea_recta(puntos)


def ruta_en_linea_recta(puntos):
    tramos = []
    for a, b in zip(puntos, puntos[1:]):
        km = distancia_km(a["lat"], a["lon"], b["lat"], b["lon"])
        tramos.append({"desde": a["nombre"], "hasta": b["nombre"], "distancia_km": round(km, 2),
                       "duracion_min": round(km / VELOCIDAD_PROMEDIO_KMH * 60)})
    return {
        "fuente": "linea_recta",
        "distancia_km": round(sum(t["distancia_km"] for t in tramos), 2),
        "duracion_min": sum(t["duracion_min"] for t in tramos),
        "tramos": tramos,
        "geometria": [[float(p["lat"]), float(p["lon"])] for p in puntos],
        "puntos": puntos,
    }


def ruta_de_recogida(recogida, lat=None, lon=None):
    """Ruta del voluntario: (su ubicación) → donante → receptor. Si ya recogió, solo → receptor."""
    origen = recogida.donacion.donante
    destino = recogida.asignacion.receptor
    puntos = []
    if lat is not None and lon is not None:
        puntos.append({"lat": float(lat), "lon": float(lon), "nombre": "Tu ubicación", "tipo": "voluntario"})
    if recogida.estado in ("DISPONIBLE", "TOMADA"):
        puntos.append({"lat": float(origen.latitud), "lon": float(origen.longitud), "nombre": origen.razon_social,
                       "tipo": "recoger", "direccion": origen.direccion})
    puntos.append({"lat": float(destino.latitud), "lon": float(destino.longitud), "nombre": destino.razon_social,
                   "tipo": "entregar", "direccion": destino.direccion})
    if len(puntos) < 2:  # ya recogió y no compartió su ubicación: muestra el tramo donante → receptor
        puntos.insert(0, {"lat": float(origen.latitud), "lon": float(origen.longitud),
                          "nombre": origen.razon_social, "tipo": "recoger", "direccion": origen.direccion})
    return calcular_ruta(puntos)
