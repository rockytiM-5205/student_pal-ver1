from django.contrib import admin
from .models import Assignment, Submission


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display  = ("course_code", "title", "lecturer", "due_date", "submission_count", "created_at")
    list_filter   = ("department", "level")
    search_fields = ("course_code", "title", "lecturer")
    readonly_fields = ("created_at", "updated_at")
    ordering      = ("due_date",)


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display  = ("student", "assignment", "submitted_at", "was_late")
    list_filter   = ("assignment",)
    search_fields = ("student__email", "student__username", "assignment__title")
    readonly_fields = ("submitted_at",)