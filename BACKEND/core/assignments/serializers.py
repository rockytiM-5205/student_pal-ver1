"""
assignments/serializers.py
"""

from django.utils import timezone
from rest_framework import serializers
from .models import Assignment, Submission


class SubmissionSerializer(serializers.ModelSerializer):
    """Used by admins to see who submitted what."""
    student_name  = serializers.SerializerMethodField()
    student_email = serializers.CharField(source="student.email", read_only=True)
    file_url      = serializers.SerializerMethodField()
    was_late      = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Submission
        fields = [
            "id", "student_name", "student_email", "file_url",
            "was_late", "submitted_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class AssignmentSerializer(serializers.ModelSerializer):
    """
    Used for listing/retrieving assignments. `status` is computed
    per the requesting student: pending / submitted / overdue.
    Admins additionally see submission_count.
    """
    is_overdue        = serializers.BooleanField(read_only=True)
    submission_count  = serializers.IntegerField(read_only=True)
    status            = serializers.SerializerMethodField()
    my_submission     = serializers.SerializerMethodField()
    created_by_name   = serializers.SerializerMethodField()

    class Meta:
        model  = Assignment
        fields = [
            "id",
            "course_code",
            "title",
            "description",
            "lecturer",
            "department",
            "level",
            "due_date",
            "is_overdue",
            "submission_count",
            "status",
            "my_submission",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id", "is_overdue", "submission_count", "status",
            "my_submission", "created_by_name", "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "Admin"

    def _my_submission_obj(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return obj.submissions.filter(student=request.user).first()

    def get_status(self, obj):
        """pending | submitted | overdue — from the current student's POV."""
        submission = self._my_submission_obj(obj)
        if submission:
            return "submitted"
        if obj.is_overdue:
            return "overdue"
        return "pending"

    def get_my_submission(self, obj):
        submission = self._my_submission_obj(obj)
        if not submission:
            return None
        return SubmissionSerializer(submission, context=self.context).data


class AssignmentCreateSerializer(serializers.ModelSerializer):
    """Used by admins to create or update an assignment."""

    class Meta:
        model  = Assignment
        fields = [
            "course_code", "title", "description", "lecturer",
            "department", "level", "due_date",
        ]

    def validate_course_code(self, value):
        return value.strip().upper()

    def create(self, validated_data):
        user = self.context["request"].user
        return Assignment.objects.create(created_by=user, **validated_data)


class SubmitAssignmentSerializer(serializers.Serializer):
    """Used by a student to submit a file for an assignment."""
    file = serializers.FileField(required=True)