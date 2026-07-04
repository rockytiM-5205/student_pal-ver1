"""
accounts/admin.py
Register the custom User model with Django's admin site.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ("email", "username", "get_full_name", "role", "level", "department", "is_active", "date_joined")
    list_filter   = ("role", "level", "department", "is_active", "is_staff")
    search_fields = ("email", "username", "first_name", "last_name", "matric_number")
    ordering      = ("-date_joined",)
    readonly_fields = ("date_joined", "last_login")

    fieldsets = (
        (_("Login Credentials"), {"fields": ("email", "password")}),
        (_("Personal Info"),     {"fields": ("username", "first_name", "last_name", "phone_number")}),
        (_("Academic Info"),     {"fields": ("matric_number", "university", "faculty", "department", "level")}),
        (_("Role & Status"),     {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        (_("Permissions"),       {"fields": ("groups", "user_permissions")}),
        (_("Timestamps"),        {"fields": ("date_joined", "last_login")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "email", "username", "first_name", "last_name",
                "matric_number", "department", "level", "role",
                "password1", "password2", "is_active", "is_staff",
            ),
        }),
    )