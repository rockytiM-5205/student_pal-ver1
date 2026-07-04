"""
studentpal/urls.py
Root URL configuration for the StudentPal project.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Django admin (keep for superuser access)
    path("admin/", admin.site.urls),

    # All StudentPal API routes live under /api/
    path("api/", include("accounts.urls")),
]