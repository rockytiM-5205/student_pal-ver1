"""
assignments/views.py

Endpoints
---------
GET    /api/assignments/                 List assignments (student sees status, admin sees submission_count)
POST   /api/assignments/                 Create an assignment (admin only)
GET    /api/assignments/<id>/            Retrieve a single assignment
PATCH  /api/assignments/<id>/            Update an assignment (admin only)
DELETE /api/assignments/<id>/            Delete an assignment (admin only)
POST   /api/assignments/<id>/submit/     Student submits a file
GET    /api/assignments/<id>/submissions/  List submissions (admin only)
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from accounts.permissions import IsAdminRole
from .models import Assignment, Submission
from .serializers import (
    AssignmentSerializer, AssignmentCreateSerializer,
    SubmissionSerializer, SubmitAssignmentSerializer,
)


# ── LIST + CREATE ─────────────────────────────────────────────────────────────

class AssignmentListCreateView(APIView):
    """
    GET  /api/assignments/  — filters: ?course_code=, ?department=, ?level=, ?status=
        (status filter applies to the requesting student's computed status)
    POST /api/assignments/  — create (admin only)
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get(self, request):
        qs = Assignment.objects.all()

        course = request.query_params.get("course_code")
        dept   = request.query_params.get("department")
        level  = request.query_params.get("level")
        search = request.query_params.get("search", "").strip()

        if course: qs = qs.filter(course_code__icontains=course)
        if dept:   qs = qs.filter(department__icontains=dept)
        if level:  qs = qs.filter(level=level)
        if search:
            qs = qs.filter(title__icontains=search) | qs.filter(course_code__icontains=search)

        qs = qs.distinct()
        serializer = AssignmentSerializer(qs, many=True, context={"request": request})
        data = serializer.data

        # Optional post-filter by computed status (pending/submitted/overdue)
        status_filter = request.query_params.get("status")
        if status_filter:
            data = [a for a in data if a["status"] == status_filter]

        return Response({"count": len(data), "assignments": data})

    def post(self, request):
        serializer = AssignmentCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(
                {"message": "Failed to create assignment.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assignment = serializer.save()
        return Response(
            {
                "message": "Assignment created successfully.",
                "assignment": AssignmentSerializer(assignment, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── RETRIEVE + UPDATE + DELETE ────────────────────────────────────────────────

class AssignmentDetailView(APIView):

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get_object(self, pk):
        try:
            return Assignment.objects.get(pk=pk)
        except Assignment.DoesNotExist:
            return None

    def get(self, request, pk):
        assignment = self.get_object(pk)
        if not assignment:
            return Response({"message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AssignmentSerializer(assignment, context={"request": request})
        return Response({"assignment": serializer.data})

    def patch(self, request, pk):
        assignment = self.get_object(pk)
        if not assignment:
            return Response({"message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AssignmentCreateSerializer(
            assignment, data=request.data, partial=True, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Update failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response({
            "message": "Assignment updated.",
            "assignment": AssignmentSerializer(assignment, context={"request": request}).data,
        })

    def delete(self, request, pk):
        assignment = self.get_object(pk)
        if not assignment:
            return Response({"message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)
        assignment.delete()
        return Response({"message": "Assignment deleted."}, status=status.HTTP_200_OK)


# ── SUBMIT ────────────────────────────────────────────────────────────────────

class AssignmentSubmitView(APIView):
    """
    POST /api/assignments/<id>/submit/
    Student submits (or re-submits, overwriting) a file for an assignment.
    Multipart form data — field name: "file"
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            assignment = Assignment.objects.get(pk=pk)
        except Assignment.DoesNotExist:
            return Response({"message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmitAssignmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"message": "Please attach a file to submit.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission, created = Submission.objects.update_or_create(
            assignment=assignment,
            student=request.user,
            defaults={"file": serializer.validated_data["file"]},
        )

        message = "Assignment submitted successfully." if created else "Your submission was updated."

        return Response(
            {
                "message": message,
                "submission": SubmissionSerializer(submission, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ── ADMIN: LIST SUBMISSIONS ────────────────────────────────────────────────────

class AssignmentSubmissionsView(APIView):
    """GET /api/assignments/<id>/submissions/ — admin only."""
    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        try:
            assignment = Assignment.objects.get(pk=pk)
        except Assignment.DoesNotExist:
            return Response({"message": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        submissions = assignment.submissions.select_related("student").all()
        serializer = SubmissionSerializer(submissions, many=True, context={"request": request})
        return Response({
            "assignment_title": assignment.title,
            "count": submissions.count(),
            "submissions": serializer.data,
        })