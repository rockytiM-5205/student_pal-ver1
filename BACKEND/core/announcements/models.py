"""
announcements/models.py
Announcement model for StudentPal.
"""

from django.db import models
from django.conf import settings


class Announcement(models.Model):

    # ── Category choices ──────────────────────────────────────
    GENERAL    = "general"
    FACULTY    = "faculty"
    DEPARTMENT = "department"
    URGENT     = "urgent"

    CATEGORY_CHOICES = [
        (GENERAL,    "General"),
        (FACULTY,    "Faculty"),
        (DEPARTMENT, "Department"),
        (URGENT,     "Urgent"),
    ]

    # ── Audience choices ──────────────────────────────────────
    ALL_STUDENTS = "all"
    BY_FACULTY   = "faculty"
    BY_DEPT      = "department"

    AUDIENCE_CHOICES = [
        (ALL_STUDENTS, "All Students"),
        (BY_FACULTY,   "By Faculty"),
        (BY_DEPT,      "By Department"),
    ]

    # ── Fields ───────────────────────────────────────────────
    title    = models.CharField(max_length=255)
    body     = models.TextField()
    category = models.CharField(
        max_length=15, choices=CATEGORY_CHOICES, default=GENERAL
    )
    audience   = models.CharField(
        max_length=15, choices=AUDIENCE_CHOICES, default=ALL_STUDENTS
    )

    # Scoping — only set when audience is not 'all'
    target_faculty    = models.CharField(max_length=150, blank=True, default="")
    target_department = models.CharField(max_length=150, blank=True, default="")

    is_published = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="announcements",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name        = "Announcement"
        verbose_name_plural = "Announcements"

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"
