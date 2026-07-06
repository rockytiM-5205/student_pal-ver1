"""
resources/serializers.py
"""

from rest_framework import serializers
from .models import Resource


class ResourceSerializer(serializers.ModelSerializer):
    """
    Used for listing and retrieving resources.
    uploaded_by_name is a read-only display field.
    """
    uploaded_by_name = serializers.SerializerMethodField()
    file_url         = serializers.SerializerMethodField()
    resource_type_display = serializers.CharField(
        source="get_resource_type_display", read_only=True
    )

    class Meta:
        model  = Resource
        fields = [
            "id",
            "title",
            "description",
            "course_code",
            "resource_type",
            "resource_type_display",
            "department",
            "faculty",
            "level",
            "file_url",
            "download_count",
            "uploaded_by_name",
            "is_approved",
            "created_at",
        ]
        read_only_fields = [
            "id", "download_count", "uploaded_by_name",
            "file_url", "created_at",
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return "Admin"

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class ResourceCreateSerializer(serializers.ModelSerializer):
    """
    Used by admins to upload a new resource.
    The file field accepts multipart/form-data.
    """
    class Meta:
        model  = Resource
        fields = [
            "title",
            "description",
            "course_code",
            "resource_type",
            "department",
            "faculty",
            "level",
            "file",
        ]

    def validate_course_code(self, value):
        return value.strip().upper()

    def create(self, validated_data):
        user = self.context["request"].user
        return Resource.objects.create(
            uploaded_by=user,
            **validated_data
        )
