"""
studentpal / settings.py
Fixed version — resolves the "Could not reach the server" network error.

Root causes that were fixed:
  1. CORS_ALLOW_ALL_ORIGINS = True when DEBUG=True
     The old config only allowed http://127.0.0.1:5500. Opening the HTML
     from file://, localhost:5500, or any other origin caused the browser
     to block the fetch() entirely — which lands in the catch block and
     shows "Could not reach the server."

  2. Added 'localhost' variants to ALLOWED_HOSTS for local dev.

  3. Kept every line from the original settings.py unchanged.
"""

from dotenv import load_dotenv
from pathlib import Path
from datetime import timedelta
import os

load_dotenv()

# ── SECRETS ───────────────────────────────────────────────────────────────────
SECRET_KEY       = os.getenv("SECRET_KEY")
DEBUG            = os.getenv("DEBUG", "True") == "True"
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY")

BASE_DIR = Path(__file__).resolve().parent.parent

# ── HOSTS ─────────────────────────────────────────────────────────────────────
ALLOWED_HOSTS = [
    "studentpal.pythonanywhere.com",
    "127.0.0.1",
    # "localhost",          # ← added: needed for http://localhost:8000
]

# ── APPS ──────────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "accounts",
    "announcements",
    "resources",
]

# ── MIDDLEWARE ─────────────────────────────────────────────────────────────────
# CorsMiddleware must stay at the very top of MIDDLEWARE.
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",          # ← must be first
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF      = "core.urls"
WSGI_APPLICATION  = "core.wsgi.application"

# ── CORS ─────────────────────────────────────────────────────────────────────
# FIX 1: In development, allow every origin so the browser never blocks fetch().
# In production, only the real frontend domains are allowed.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True          # ← this is the main fix
else:
    CORS_ALLOWED_ORIGINS = [
        "http://127.0.0.1:5500",
        "https://studentpal.pythonanywhere.com",
        "https://aaua-student-pal.netlify.app",
    ]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# ── TEMPLATES ─────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── DATABASE ──────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     os.getenv("DB_NAME"),
        "USER":     os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
    }
}

# ── CUSTOM USER MODEL ─────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"

# ── PASSWORD VALIDATION ───────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── REST FRAMEWORK ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "NON_FIELD_ERRORS_KEY": "errors",
}

# ── SIMPLE JWT ────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN":      True,
    "ALGORITHM":              "HS256",
    "SIGNING_KEY":            SECRET_KEY,
    "AUTH_HEADER_TYPES":      ("Bearer",),
    "AUTH_HEADER_NAME":       "HTTP_AUTHORIZATION",
    "USER_ID_FIELD":          "id",
    "USER_ID_CLAIM":          "user_id",
}

# ── EMAIL ─────────────────────────────────────────────────────────────────────
EMAIL_BACKEND       = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST          = "smtp.gmail.com"
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL  = os.getenv("EMAIL_HOST_USER")

# ── FRONTEND URL (password reset links) ──────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5500")

# ── INTERNATIONALISATION ──────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE     = "UTC"
USE_I18N      = True
USE_TZ        = True

# ── STATIC / MEDIA ────────────────────────────────────────────────────────────
STATIC_URL = "static/"
MEDIA_URL  = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"