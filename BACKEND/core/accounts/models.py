"""
accounts/models.py
Custom User model for StudentPal.
Login identifier: email
"""

from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class UserManager(BaseUserManager):
    """
    Custom manager so we can create users with email as
    the unique identifier instead of Django's default username.
    """

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.ADMIN)

        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    StudentPal custom user model.

    Fields:
        username        — Public handle (unique)
        first_name      — Given name
        last_name       — Family name
        email           — Login identifier (unique)
        matric_number   — University matric number (unique, optional for admins)
        department      — Academic department
        level           — Study level (100–500)
        role            — student | admin
        phone_number    — Contact number (optional)
        faculty         — Faculty within the university (optional)
        university      — University name (optional, useful for multi-uni)
        is_active       — Account enabled / disabled
        is_staff        — Can access Django admin
        date_joined     — Auto-set on creation
    """

    STUDENT = "student"
    ADMIN = "admin"

    ROLE_CHOICES = [
        (STUDENT, "Student"),
        (ADMIN, "Admin"),
    ]

    LEVEL_CHOICES = [
        ("100", "100 Level"),
        ("200", "200 Level"),
        ("300", "300 Level"),
        ("400", "400 Level"),
        ("500", "500 Level"),
    ]

    # ── Core identity ────────────────────────────────────────────
    username = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)

    # ── Academic information ─────────────────────────────────────
    matric_number = models.CharField(
        max_length=20, unique=True, null=True, blank=True,
        help_text="9-digit university matric number.",
    )
    department = models.CharField(max_length=150, blank=True, default="")
    level = models.CharField(
        max_length=3, choices=LEVEL_CHOICES, blank=True, default=""
    )
    faculty = models.CharField(max_length=150, blank=True, default="")
    university = models.CharField(max_length=200, blank=True, default="")

    # ── Contact ──────────────────────────────────────────────────
    phone_number = models.CharField(max_length=20, blank=True, default="")

    # ── Role ─────────────────────────────────────────────────────
    role = models.CharField(
        max_length=10, choices=ROLE_CHOICES, default=STUDENT
    )

    # ── Django internals ─────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    objects = UserManager()

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-date_joined"]

    # ── Helpers ──────────────────────────────────────────────────
    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name

    @property
    def is_student(self):
        return self.role == self.STUDENT

    @property
    def is_admin_user(self):
        return self.role == self.ADMIN