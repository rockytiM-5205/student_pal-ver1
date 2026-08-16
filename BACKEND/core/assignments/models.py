"""
assignments/models.py
Assignment + Submission models for StudentPal.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class Assignment(models.Model):
    course_code = models.CharField(max_length=20)
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    lecturer    = models.CharField(max_length=150, blank=True, default="")
    department  = models.CharField(max_length=150, blank=True, default="")
    level       = models.CharField(max_length=3, blank=True, default="")

    due_date = models.DateTimeField()

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="created_assignments",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date"]

    def __str__(self):
        return f"[{self.course_code}] {self.title}"

    @property
    def is_overdue(self):
        return timezone.now() > self.due_date

    @property
    def submission_count(self):
        return self.submissions.count()


class Submission(models.Model):
    """One submission per student per assignment."""
    assignment = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, related_name="submissions"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assignment_submissions"
    )
    file = models.FileField(upload_to="submissions/")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["assignment", "student"]
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.student} → {self.assignment.title}"

    @property
    def was_late(self):
        return self.submitted_at > self.assignment.due_date