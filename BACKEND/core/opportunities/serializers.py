"""
opportunities/serializers.py
"""

from rest_framework import serializers
from .models import Opportunity, Application


class OpportunitySerializer(serializers.ModelSerializer):
    """
    Used for listing and retrieving opportunities (students + admins).
    Includes computed fields the frontend needs for badges/deadlines,
    and has_applied so the student UI can show "Applied" vs "Apply Now".
    """

    opportunity_type_display = serializers.CharField(
        source="get_opportunity_type_display", read_only=True
    )
    urgency          = serializers.CharField(read_only=True)
    days_until_deadline = serializers.IntegerField(read_only=True)
    is_expired       = serializers.BooleanField(read_only=True)
    applicant_count  = serializers.IntegerField(read_only=True)
    created_by_name  = serializers.SerializerMethodField()
    has_applied      = serializers.SerializerMethodField()

    class Meta:
        model  = Opportunity
        fields = [
            "id",
            "title",
            "description",
            "opportunity_type",
            "opportunity_type_display",
            "organization",
            "deadline",
            "urgency",
            "days_until_deadline",
            "is_expired",
            "is_active",
            "applicant_count",
            "has_applied",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id", "urgency", "days_until_deadline", "is_expired",
            "applicant_count", "has_applied", "created_by_name", "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "Admin"

    def get_has_applied(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.applications.filter(student=request.user).exists()


class OpportunityCreateSerializer(serializers.ModelSerializer):
    """Used by admins to create or update an opportunity."""

    class Meta:
        model  = Opportunity
        fields = [
            "title",
            "description",
            "opportunity_type",
            "organization",
            "deadline",
            "is_active",
        ]

    def validate_deadline(self, value):
        from django.utils import timezone
        if value < timezone.now().date():
            raise serializers.ValidationError(
                "Deadline cannot be in the past."
            )
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        return Opportunity.objects.create(created_by=user, **validated_data)


class ApplicationSerializer(serializers.ModelSerializer):
    """
    Used for listing applications — mainly for the admin view of who
    applied to a given opportunity.
    """
    student_name  = serializers.SerializerMethodField()
    student_email = serializers.CharField(source="student.email", read_only=True)
    opportunity_title = serializers.CharField(source="opportunity.title", read_only=True)

    class Meta:
        model  = Application
        fields = [
            "id",
            "opportunity",
            "opportunity_title",
            "student_name",
            "student_email",
            "applied_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username