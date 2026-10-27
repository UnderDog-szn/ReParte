from .models import Notificacion


def notificar(usuarios, tipo, titulo, mensaje, donacion=None):
    """
    Simulación de notificaciones: se guardan en la base y se imprimen en la consola del servidor.
    En producción aquí se encolaría el envío por push (Firebase) y correo.
    """
    creadas = []
    for usuario in usuarios:
        if usuario is None:
            continue
        creadas.append(Notificacion.objects.create(
            usuario=usuario, tipo=tipo, titulo=titulo, mensaje=mensaje, donacion=donacion
        ))
        print(f"[NOTIFICACIÓN → {usuario.email}] {titulo}: {mensaje}")
    return creadas
