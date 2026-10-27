"""Utilidades geográficas. Reemplazan a PostGIS en la simulación."""
from math import asin, cos, radians, sin, sqrt

RADIO_TIERRA_KM = 6371.0


def distancia_km(lat1, lon1, lat2, lon2):
    """Distancia en línea recta entre dos puntos (fórmula de Haversine)."""
    lat1, lon1, lat2, lon2 = map(lambda v: radians(float(v)), (lat1, lon1, lat2, lon2))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * RADIO_TIERRA_KM * asin(sqrt(a))
