"""
announcements/views.py

Endpoints
---------
GET    /api/announcements/          List published announcements (filterable)
POST   /api/announcements/          Create announcement (admin only)
GET    /api/announcements/<id>/     Retrieve single announcement
PATCH  /api/announcements/<id>/     Update announcement (admin only)
DELETE /api/announcements/<id>/     Delete announcement (admin only)
PATCH  /api/announcements/<id>/publish/  Publish or unpublish (admin only)
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdminRole

from .models import Announcement
from .serializers import AnnouncementSerializer, AnnouncementCreateSerializer


# ── LIST + CREATE ─────────────────────────────────────────────────────────────

class AnnouncementListCreateView(APIView):
    """
    GET  /api/announcements/  — list published announcements.
    Supports filters:
        ?category=urgent
        ?audience=all
        ?department=Computer Science
        ?faculty=Faculty of Science
        ?search=exam

    Admins additionally see unpublished drafts if ?draft=true is passed.

    POST /api/announcements/  — create (admin only)
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get(self, request):
        user     = request.user
        is_admin = user.is_staff or getattr(user, "role", None) == "admin"

        # Admins can see drafts; students only see published
        if is_admin and request.query_params.get("draft") == "true":
            qs = Announcement.objects.all()
        else:
            qs = Announcement.objects.filter(is_published=True)

        # Scope to the student's own dept/faculty where applicable
        category = request.query_params.get("category")
        audience = request.query_params.get("audience")
        dept     = request.query_params.get("department")
        faculty  = request.query_params.get("faculty")
        search   = request.query_params.get("search", "").strip()

        if category: qs = qs.filter(category=category)
        if audience: qs = qs.filter(audience=audience)
        if dept:     qs = qs.filter(target_department__icontains=dept)
        if faculty:  qs = qs.filter(target_faculty__icontains=faculty)
        if search:
            qs = qs.filter(title__icontains=search) | \
                 qs.filter(body__icontains=search)

        serializer = AnnouncementSerializer(qs.distinct(), many=True)
        return Response({
            "count":         qs.distinct().count(),
            "announcements": serializer.data,
        })

    def post(self, request):
        serializer = AnnouncementCreateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Failed to create announcement.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        announcement = serializer.save()
        return Response(
            {
                "message":      "Announcement created successfully.",
                "announcement": AnnouncementSerializer(announcement).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── RETRIEVE + UPDATE + DELETE ────────────────────────────────────────────────

class AnnouncementDetailView(APIView):

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get_object(self, pk):
        try:
            return Announcement.objects.get(pk=pk)
        except Announcement.DoesNotExist:
            return None

    def get(self, request, pk):
        ann = self.get_object(pk)
        if not ann:
            return Response(
                {"message": "Announcement not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Students can only read published announcements
        if not ann.is_published:
            is_admin = request.user.is_staff or getattr(request.user, "role", None) == "admin"
            if not is_admin:
                return Response(
                    {"message": "Announcement not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        serializer = AnnouncementSerializer(ann)
        return Response({"announcement": serializer.data})

    def patch(self, request, pk):
        ann = self.get_object(pk)
        if not ann:
            return Response(
                {"message": "Announcement not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = AnnouncementCreateSerializer(
            ann, data=request.data, partial=True, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Update failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(
            {"message": "Announcement updated.", "announcement": AnnouncementSerializer(ann).data}
        )

    def delete(self, request, pk):
        ann = self.get_object(pk)
        if not ann:
            return Response(
                {"message": "Announcement not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        ann.delete()
        return Response({"message": "Announcement deleted."}, status=status.HTTP_200_OK)


# ── PUBLISH / UNPUBLISH ───────────────────────────────────────────────────────

class AnnouncementPublishView(APIView):
    """
    PATCH /api/announcements/<id>/publish/
    Body: { "is_published": true }
    Toggles the published state of an announcement.
    """
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        try:
            ann = Announcement.objects.get(pk=pk)
        except Announcement.DoesNotExist:
            return Response(
                {"message": "Announcement not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_published = request.data.get("is_published")
        if is_published is None:
            return Response(
                {"message": "is_published field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ann.is_published = bool(is_published)
        ann.save()

        action = "published" if ann.is_published else "unpublished"
        return Response({
            "message":      f"Announcement {action} successfully.",
            "announcement": AnnouncementSerializer(ann).data,
        })