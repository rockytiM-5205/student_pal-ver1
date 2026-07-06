"""
resources/views.py

Endpoints
---------
GET    /api/resources/            List all approved resources (filterable)
POST   /api/resources/            Upload a new resource (admin only)
GET    /api/resources/<id>/       Retrieve a single resource
PATCH  /api/resources/<id>/       Update resource metadata (admin only)
DELETE /api/resources/<id>/       Delete a resource (admin only)
GET    /api/resources/<id>/download/  Increment download count + return file URL
"""

from django.http import FileResponse
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdminRole
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Resource
from .serializers import ResourceSerializer, ResourceCreateSerializer


# ── PERMISSION HELPER ─────────────────────────────────────────────────────────

class IsAdminOrReadOnly:
    """
    Students can read (GET).
    Only admins (is_staff=True or role='admin') can write.
    """
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and (
            request.user.is_staff or
            getattr(request.user, "role", None) == "admin"
        )


# ── LIST + CREATE ─────────────────────────────────────────────────────────────

class ResourceListCreateView(APIView):
    """
    GET  /api/resources/  — list resources with optional filters:
        ?department=Computer Science
        ?level=200
        ?resource_type=past_questions
        ?course_code=CSC201
        ?search=data structures

    POST /api/resources/  — upload resource (admin only, multipart)
    """
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get(self, request):
        qs = Resource.objects.filter(is_approved=True)

        # Query param filters
        dept   = request.query_params.get("department")
        level  = request.query_params.get("level")
        rtype  = request.query_params.get("resource_type")
        code   = request.query_params.get("course_code")
        search = request.query_params.get("search", "").strip()

        if dept:   qs = qs.filter(department__icontains=dept)
        if level:  qs = qs.filter(level=level)
        if rtype:  qs = qs.filter(resource_type=rtype)
        if code:   qs = qs.filter(course_code__icontains=code)
        if search:
            qs = qs.filter(
                title__icontains=search
            ) | qs.filter(
                course_code__icontains=search
            ) | qs.filter(
                description__icontains=search
            )

        serializer = ResourceSerializer(
            qs.distinct(), many=True, context={"request": request}
        )
        return Response({
            "count":     qs.distinct().count(),
            "resources": serializer.data,
        })

    def post(self, request):
        serializer = ResourceCreateSerializer(
            data=request.data,
            context={"request": request}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Upload failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        resource = serializer.save()
        return Response(
            {
                "message": "Resource uploaded successfully.",
                "resource": ResourceSerializer(
                    resource, context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── RETRIEVE + UPDATE + DELETE ────────────────────────────────────────────────

class ResourceDetailView(APIView):

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get_object(self, pk):
        try:
            return Resource.objects.get(pk=pk)
        except Resource.DoesNotExist:
            return None

    def get(self, request, pk):
        resource = self.get_object(pk)
        if not resource:
            return Response(
                {"message": "Resource not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ResourceSerializer(resource, context={"request": request})
        return Response({"resource": serializer.data})

    def patch(self, request, pk):
        resource = self.get_object(pk)
        if not resource:
            return Response(
                {"message": "Resource not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ResourceSerializer(
            resource, data=request.data, partial=True,
            context={"request": request}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Update failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(
            {"message": "Resource updated.", "resource": serializer.data}
        )

    def delete(self, request, pk):
        resource = self.get_object(pk)
        if not resource:
            return Response(
                {"message": "Resource not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        resource.file.delete(save=False)  # remove actual file from disk
        resource.delete()
        return Response(
            {"message": "Resource deleted."},
            status=status.HTTP_200_OK,
        )


# ── DOWNLOAD ──────────────────────────────────────────────────────────────────

class ResourceDownloadView(APIView):
    """
    GET /api/resources/<id>/download/
    Increments the download counter and returns the file URL.
    The frontend uses the file_url to trigger the browser download.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            resource = Resource.objects.get(pk=pk, is_approved=True)
        except Resource.DoesNotExist:
            return Response(
                {"message": "Resource not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        resource.increment_download()

        file_url = request.build_absolute_uri(resource.file.url)
        return Response({
            "message":  "Download ready.",
            "file_url": file_url,
            "filename": resource.file.name.split("/")[-1],
            "title":    resource.title,
        })