"""
accounts/management/commands/create_admin.py

Creates a StudentPal admin account correctly in one step —
sets role="admin" AND is_staff=True together, so you never
have to manually patch a user in the Django shell again.

Usage:
    python manage.py create_admin

It will prompt you for email, username, first/last name, and password.

Or non-interactively:
    python manage.py create_admin --email admin@studentpal.com \\
        --username admin --first-name Admin --last-name User \\
        --password YourStrongPassword123
"""

import getpass
from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from accounts.models import User


class Command(BaseCommand):
    help = "Create a StudentPal admin account (sets role='admin' and is_staff=True)."

    def add_arguments(self, parser):
        parser.add_argument("--email", type=str, help="Admin email address")
        parser.add_argument("--username", type=str, help="Admin username")
        parser.add_argument("--first-name", type=str, help="First name")
        parser.add_argument("--last-name", type=str, help="Last name")
        parser.add_argument("--password", type=str, help="Password (skip prompt if provided)")

    def handle(self, *args, **options):
        email      = options.get("email")      or input("Email address: ").strip().lower()
        username   = options.get("username")   or input("Username: ").strip()
        first_name = options.get("first_name") or input("First name: ").strip()
        last_name  = options.get("last_name")  or input("Last name: ").strip()
        password   = options.get("password")   or getpass.getpass("Password: ")

        # ── Validate uniqueness before touching the database ────────────────
        if User.objects.filter(email=email).exists():
            raise CommandError(f"A user with email '{email}' already exists.")
        if User.objects.filter(username__iexact=username).exists():
            raise CommandError(f"Username '{username}' is already taken.")

        # ── Validate password using Django's normal password rules ──────────
        try:
            validate_password(password)
        except ValidationError as e:
            raise CommandError("Password error: " + " ".join(e.messages))

        # ── Create the user — the one place role + is_staff are set together ──
        user = User.objects.create_user(
            email=email,
            username=username,
            first_name=first_name,
            last_name=last_name,
            password=password,
            role=User.ADMIN,     # ← custom field used by IsAdminRole permission
            is_staff=True,        # ← Django's own admin-panel access flag
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Admin account created successfully:\n"
                f"   Email:    {user.email}\n"
                f"   Username: {user.username}\n"
                f"   Role:     {user.role}\n"
                f"   is_staff: {user.is_staff}\n\n"
                f"You can now log in with this account on the login page,\n"
                f"or access /admin/ using these credentials.\n"
            )
        )