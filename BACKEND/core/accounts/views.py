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
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


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