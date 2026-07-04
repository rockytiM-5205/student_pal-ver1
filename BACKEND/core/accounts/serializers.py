"""
accounts/serializers.py
DRF serializers for StudentPal authentication.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


# ── REGISTRATION ─────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    """
    Validates and creates a new Student account.

    Extra fields (phone_number, faculty, university) are optional —
    they come from the registration form but are not required by the model.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "username",
            "first_name",
            "last_name",
            "email",
            "matric_number",
            "department",
            "level",
            "phone_number",
            "faculty",
            "university",
            "password",
            "confirm_password",
        ]
        extra_kwargs = {
            "first_name":    {"required": True},
            "last_name":     {"required": True},
            "email":         {"required": True},
            "matric_number": {"required": False},
            "department":    {"required": False},
            "level":         {"required": False},
            "phone_number":  {"required": False},
            "faculty":       {"required": False},
            "university":    {"required": False},
        }

    # ── Field-level validation ────────────────────────────────────────────────

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "An account with this email address already exists."
            )
        return value

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "This username is already taken. Please choose another."
            )
        if len(value) < 3:
            raise serializers.ValidationError(
                "Username must be at least 3 characters long."
            )
        return value

    def validate_matric_number(self, value):
        if not value:
            return value
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError(
                "Matric number must contain digits only."
            )
        if len(value) != 9:
            raise serializers.ValidationError(
                "Matric number must be exactly 9 digits."
            )
        if User.objects.filter(matric_number=value).exists():
            raise serializers.ValidationError(
                "This matric number is already registered."
            )
        return value

    # ── Object-level validation ───────────────────────────────────────────────

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match. Please try again."}
            )
        return attrs

    # ── Create ────────────────────────────────────────────────────────────────

    def create(self, validated_data):
        """Hash password and create the student account."""
        validated_data["role"] = User.STUDENT
        validated_data["email"] = validated_data["email"].lower()
        user = User.objects.create_user(**validated_data)
        return user


# ── LOGIN ─────────────────────────────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    """
    Validates email + password credentials.
    Attaches the authenticated User to validated_data['user'].
    """

    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        email = attrs.get("email", "").lower().strip()
        password = attrs.get("password", "")

        # authenticate() uses USERNAME_FIELD (email) under the hood
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                {"non_field_errors": "Invalid email or password. Please try again."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"non_field_errors": "Your account has been suspended. Contact support."}
            )

        attrs["user"] = user
        return attrs


# ── USER PROFILE ──────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    """
    Read / update a user's profile.
    Sensitive fields (password, is_staff, is_superuser) are excluded.
    The role field is read-only — roles are set by admins only.
    """

    full_name = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(
        format="%Y-%m-%dT%H:%M:%SZ", read_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "matric_number",
            "department",
            "level",
            "faculty",
            "university",
            "phone_number",
            "role",
            "date_joined",
        ]
        read_only_fields = ["id", "role", "date_joined", "email"]

    def get_full_name(self, obj):
        return obj.get_full_name()