"""
opportunities/models.py
Scholarship / internship / competition / ambassador opportunity model.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class Opportunity(models.Model):

    # ── Type choices ──────────────────────────────────────────
    SCHOLARSHIP  = "scholarship"
    INTERNSHIP   = "internship"
    COMPETITION  = "competition"
    AMBASSADOR   = "ambassador"

    TYPE_CHOICES = [
        (SCHOLARSHIP, "Scholarship"),
        (INTERNSHIP,  "Internship"),
        (COMPETITION, "Competition"),
        (AMBASSADOR,  "Ambassador Program"),
    ]

    # ── Fields ───────────────────────────────────────────────
    title           = models.CharField(max_length=255)
    description     = models.TextField()
    opportunity_type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default=SCHOLARSHIP
    )

    organization = models.CharField(
        max_length=200, blank=True, default="",
        help_text="e.g. MTN Foundation, Andela, Google"
    )

    deadline    = models.DateField()
    is_active   = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="created_opportunities",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["deadline"]
        verbose_name        = "Opportunity"
        verbose_name_plural = "Opportunities"

    def __str__(self):
        return f"[{self.get_opportunity_type_display()}] {self.title}"

    @property
    def is_expired(self):
        return self.deadline < timezone.now().date()

    @property
    def days_until_deadline(self):
        delta = self.deadline - timezone.now().date()
        return delta.days

    @property
    def urgency(self):
        """
        Used by the frontend to colour-code deadline badges.
        Returns: 'expired' | 'urgent' | 'soon' | 'normal'
        """
        days = self.days_until_deadline
        if days < 0:
            return "expired"
        if days <= 3:
            return "urgent"
        if days <= 14:
            return "soon"
        return "normal"

    @property
    def applicant_count(self):
        return self.applications.count()


class Application(models.Model):
    """
    Tracks which students have applied to which opportunity.
    A student can only apply once per opportunity (unique_together).
    """

    opportunity = models.ForeignKey(
        Opportunity, on_delete=models.CASCADE, related_name="applications"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="opportunity_applications",
    )
    applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["opportunity", "student"]
        ordering = ["-applied_at"]

    def __str__(self):
        return f"{self.student} → {self.opportunity.title}"