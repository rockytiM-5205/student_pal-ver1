"""
accounts/views.py — StudentPal authentication API views.
All 500 errors now return JSON so the frontend can read them.
"""

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    AdminCreateStudentSerializer,
)
from .permissions import IsAdminRole


# ── HELPER ────────────────────────────────────────────────────────────────────

def make_jwt_response(user):
    """Generate access + refresh token pair and embed role in access token."""
    refresh = RefreshToken.for_user(user)
    refresh.access_token["role"]     = user.role
    refresh.access_token["username"] = user.username
    return {
        "access":  str(refresh.access_token),
        "refresh": str(refresh),
    }


# ── REGISTRATION ──────────────────────────────────────────────────────────────

class RegisterAPIView(APIView):
    """POST /api/register/"""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            serializer = RegisterSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {
                        "message": "Registration failed. Please fix the errors below.",
                        "errors": serializer.errors,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = serializer.save()
            return Response(
                {
                    "message": "Account created successfully! Redirecting you to sign in…",
                    "user":    UserSerializer(user).data,
                    "tokens":  make_jwt_response(user),
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            # Return JSON so the frontend can display the message properly
            return Response(
                {"message": f"Registration error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ── LOGIN ─────────────────────────────────────────────────────────────────────

class LoginAPIView(APIView):
    """POST /api/login/"""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            serializer = LoginSerializer(
                data=request.data,
                context={"request": request},
            )
            if not serializer.is_valid():
                return Response(
                    {
                        "message": "Login failed. Please check your credentials.",
                        "errors":  serializer.errors,
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            user = serializer.validated_data["user"]
            return Response(
                {
                    "message": f"Welcome back, {user.first_name}!",
                    "user":    UserSerializer(user).data,
                    "tokens":  make_jwt_response(user),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"message": f"Login error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ── LOGOUT ────────────────────────────────────────────────────────────────────

class LogoutAPIView(APIView):
    """POST /api/logout/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"message": "Refresh token is required to log out."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out successfully."})
        except TokenError:
            return Response({"message": "Logged out."})


# ── PROFILE ───────────────────────────────────────────────────────────────────

class ProfileAPIView(generics.RetrieveUpdateAPIView):
    """GET /api/profile/ and PATCH /api/profile/"""
    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response({"message": "Profile loaded.", "user": serializer.data})

    def partial_update(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            self.get_object(), data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Profile update failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response({"message": "Profile updated successfully.", "user": serializer.data})


# ── ADMIN: STUDENT MANAGEMENT ──────────────────────────────────────────────────
#
# Both self-registered students (via /api/register/) and admin-created
# students (via /api/admin/students/) are rows in the exact same User
# table — there is no separate storage for either path. This view simply
# lists everyone with role=student, regardless of how their account
# was created.

class AdminStudentListCreateView(APIView):
    """
    GET  /api/admin/students/
        Optional filters: ?search=, ?department=, ?level=, ?status=active|suspended

    POST /api/admin/students/
        Admin creates a student account directly. Returns the generated
        password ONCE in the response if none was supplied — the admin
        must copy it now, it is never shown again (it's hashed in the DB
        exactly like a self-registered student's password).
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = User.objects.filter(role=User.STUDENT)

        search = request.query_params.get("search", "").strip()
        department = request.query_params.get("department")
        level = request.query_params.get("level")
        status_filter = request.query_params.get("status")

        if search:
            qs = qs.filter(first_name__icontains=search) | \
                 qs.filter(last_name__icontains=search) | \
                 qs.filter(matric_number__icontains=search) | \
                 qs.filter(email__icontains=search)
        if department:
            qs = qs.filter(department__icontains=department)
        if level:
            qs = qs.filter(level=level)
        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "suspended":
            qs = qs.filter(is_active=False)

        qs = qs.distinct().order_by("-date_joined")
        serializer = UserSerializer(qs, many=True)
        return Response({"count": qs.count(), "students": serializer.data})

    def post(self, request):
        serializer = AdminCreateStudentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"message": "Failed to create student.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()
        generated_password = getattr(user, "_generated_password", None)

        response_data = {
            "message": f"Student account created for {user.get_full_name()}.",
            "student": UserSerializer(user).data,
        }
        # Only included when the admin didn't supply their own password —
        # this is the one and only time it's ever visible in plaintext.
        if generated_password:
            response_data["generated_password"] = generated_password
            response_data["message"] += " A temporary password was generated — share it securely."

        return Response(response_data, status=status.HTTP_201_CREATED)


class AdminStudentDetailView(APIView):
    """
    PATCH  /api/admin/students/<id>/   Body: { "is_active": false }  → suspend/unsuspend
    DELETE /api/admin/students/<id>/   Permanently remove the account
    """
    permission_classes = [IsAdminRole]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk, role=User.STUDENT)
        except User.DoesNotExist:
            return None

    def patch(self, request, pk):
        student = self.get_object(pk)
        if not student:
            return Response({"message": "Student not found."}, status=status.HTTP_404_NOT_FOUND)

        if "is_active" in request.data:
            student.is_active = bool(request.data["is_active"])
            student.save()
            action = "activated" if student.is_active else "suspended"
            return Response({
                "message": f"{student.get_full_name()} has been {action}.",
                "student": UserSerializer(student).data,
            })

        return Response(
            {"message": "No recognized fields to update. Use is_active: true/false."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        student = self.get_object(pk)
        if not student:
            return Response({"message": "Student not found."}, status=status.HTTP_404_NOT_FOUND)

        name = student.get_full_name()
        student.delete()
        return Response({"message": f"{name}'s account has been deleted."})