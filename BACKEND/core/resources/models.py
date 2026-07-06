"""
resources/models.py
Academic resource model for StudentPal.
"""

from django.db import models
from django.conf import settings


class Resource(models.Model):

    # ── Type choices ──────────────────────────────────────────
    PAST_QUESTIONS = "past_questions"
    LECTURE_NOTES  = "lecture_notes"
    HANDOUT        = "handout"
    EBOOK          = "ebook"

    RESOURCE_TYPES = [
        (PAST_QUESTIONS, "Past Questions"),
        (LECTURE_NOTES,  "Lecture Notes"),
        (HANDOUT,        "Handout"),
        (EBOOK,          "E-book"),
    ]

    # ── Level choices ─────────────────────────────────────────
    LEVEL_CHOICES = [
        ("100", "100 Level"),
        ("200", "200 Level"),
        ("300", "300 Level"),
        ("400", "400 Level"),
        ("500", "500 Level"),
    ]

    # ── Fields ───────────────────────────────────────────────
    title         = models.CharField(max_length=255)
    description   = models.TextField(blank=True, default="")
    course_code   = models.CharField(max_length=20)
    resource_type = models.CharField(
        max_length=20, choices=RESOURCE_TYPES, default=LECTURE_NOTES
    )
    department    = models.CharField(max_length=150)
    faculty       = models.CharField(max_length=150, blank=True, default="")
    level         = models.CharField(
        max_length=3, choices=LEVEL_CHOICES, blank=True, default=""
    )

    # File stored in media/resources/
    file           = models.FileField(upload_to="resources/")
    download_count = models.PositiveIntegerField(default=0)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="uploaded_resources",
    )

    is_approved  = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name        = "Resource"
        verbose_name_plural = "Resources"

    def __str__(self):
        return f"[{self.course_code}] {self.title}"

    def increment_download(self):
        """Call this every time a student downloads the file."""
        Resource.objects.filter(pk=self.pk).update(
            download_count=models.F("download_count") + 1
        )
