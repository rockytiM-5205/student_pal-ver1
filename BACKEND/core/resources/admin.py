from django.contrib import admin
from .models import Resource

@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display  = ("title", "course_code", "resource_type", "department", "level", "download_count", "is_approved", "created_at")
    list_filter   = ("resource_type", "department", "level", "is_approved")
    search_fields = ("title", "course_code", "department")
    readonly_fields = ("download_count", "created_at", "updated_at")
    ordering      = ("-created_at",)