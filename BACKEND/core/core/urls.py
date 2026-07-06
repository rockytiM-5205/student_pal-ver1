"""
Root URL configuration for the StudentPal project.

This is the file Django loads first (ROOT_URLCONF in settings.py).
Every app's urls.py gets included here under its own /api/ prefix.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # ── Django admin panel ──────────────────────────────────────
    path("admin/", admin.site.urls),

    # ── Auth: register, login, logout, profile, token refresh ───
    path("api/", include("accounts.urls")),

    # ── Resources: list/upload/download/delete ───────────────────
    path("api/resources/", include("resources.urls")),

    # ── Announcements: list/create/publish/delete ────────────────
    path("api/announcements/", include("announcements.urls")),

    # ── Add future apps the same way ──────────────────────────────
    # path("api/opportunities/", include("opportunities.urls")),
    # path("api/community/",     include("community.urls")),
    # path("api/assignments/",   include("assignments.urls")),
    # path("api/calendar/",      include("calendar_app.urls")),
]

# ── Serve uploaded media files (resource files) in development ───
# In production, your web server (nginx / PythonAnywhere) serves
# these directly — this block only runs when DEBUG=True.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)