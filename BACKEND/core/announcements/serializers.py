"""
announcements/serializers.py
"""

from rest_framework import serializers
from .models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    """Used for listing and retrieving announcements (students + admins)."""

    created_by_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    audience_display = serializers.CharField(
        source="get_audience_display", read_only=True
    )

    class Meta:
        model  = Announcement
        fields = [
            "id",
            "title",
            "body",
            "category",
            "category_display",
            "audience",
            "audience_display",
            "target_faculty",
            "target_department",
            "is_published",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id", "created_by_name", "created_at",
            "category_display", "audience_display",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "Admin"


class AnnouncementCreateSerializer(serializers.ModelSerializer):
    """Used by admins to create or update announcements."""

    class Meta:
        model  = Announcement
        fields = [
            "title",
            "body",
            "category",
            "audience",
            "target_faculty",
            "target_department",
            "is_published",
        ]

    def validate(self, attrs):
        audience = attrs.get("audience")
        if audience == Announcement.BY_FACULTY and not attrs.get("target_faculty"):
            raise serializers.ValidationError(
                {"target_faculty": "target_faculty is required when audience is 'faculty'."}
            )
        if audience == Announcement.BY_DEPT and not attrs.get("target_department"):
            raise serializers.ValidationError(
                {"target_department": "target_department is required when audience is 'department'."}
            )
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        return Announcement.objects.create(created_by=user, **validated_data)
