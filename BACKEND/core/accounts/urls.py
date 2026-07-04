"""
accounts/urls.py
URL patterns for the accounts app.
All routes are prefixed with /api/ in the root urls.py.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterAPIView,
    LoginAPIView,
    LogoutAPIView,
    ProfileAPIView,
)

urlpatterns = [
    # ── Authentication ──────────────────────────────────────────
    path("register/", RegisterAPIView.as_view(), name="register"),
    path("login/",    LoginAPIView.as_view(),    name="login"),
    path("logout/",   LogoutAPIView.as_view(),   name="logout"),

    # ── Token management ────────────────────────────────────────
    # POST { "refresh": "..." } → returns a new access token
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # ── Profile ──────────────────────────────────────────────────
    path("profile/", ProfileAPIView.as_view(), name="profile"),
]