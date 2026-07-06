"""
accounts/permissions.py
Shared DRF permission classes used across all StudentPal apps.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminRole(BasePermission):
    """
    Grants write access (POST/PATCH/PUT/DELETE) only to users who are
    admins — either Django's built-in is_staff flag OR our custom
    role='admin' field. GET/HEAD/OPTIONS still require login only.

    This fixes the bug where rest_framework.permissions.IsAdminUser
    checks ONLY is_staff, which is False for every account created
    through the normal /api/register/ endpoint (it always sets
    role='student' and never touches is_staff). 
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Safe methods (GET/HEAD/OPTIONS) just need to be logged in
        if request.method in SAFE_METHODS:
            return True

        # Write methods need real admin privileges
        return bool(
            request.user.is_staff or
            getattr(request.user, "role", None) == "admin"
        )


class IsAdminRoleWriteOnly(BasePermission):
    """
    Same admin check as above, but does NOT grant read access —
    use this when you need to pair it with IsAuthenticated separately,
    or when a view should be write-only for admins with no GET method.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(
            request.user.is_staff or
            getattr(request.user, "role", None) == "admin"
        )
