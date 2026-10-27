from rest_framework.permissions import BasePermission

from apps.usuarios.models import Usuario


class _PorRol(BasePermission):
    rol = None
    message = "Tu rol no permite esta acción."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated and u.rol == self.rol):
            return False
        if self.rol in (Usuario.Rol.DONANTE, Usuario.Rol.RECEPTOR):
            if not (u.organizacion and u.organizacion.verificada):
                self.message = "Tu organización aún no está verificada."
                return False
        if self.rol == Usuario.Rol.VOLUNTARIO and not hasattr(u, "perfil_voluntario"):
            self.message = "No tienes perfil de voluntario."
            return False
        return True


class EsDonante(_PorRol):
    rol = Usuario.Rol.DONANTE


class EsReceptor(_PorRol):
    rol = Usuario.Rol.RECEPTOR


class EsVoluntario(_PorRol):
    rol = Usuario.Rol.VOLUNTARIO


class EsAdmin(BasePermission):
    message = "Solo para administradores."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.rol == Usuario.Rol.ADMIN or u.is_superuser))
