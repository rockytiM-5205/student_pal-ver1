"""
community/models.py
Student community — posts, comments, likes, and content reports.
"""

from django.db import models
from django.conf import settings


class Post(models.Model):
    """A student post in the community feed."""

    author  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    content = models.TextField(max_length=2000)

    is_hidden = models.BooleanField(
        default=False,
        help_text="Set True by an admin to hide a post without deleting it."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name        = "Post"
        verbose_name_plural = "Posts"

    def __str__(self):
        preview = self.content[:50] + ("…" if len(self.content) > 50 else "")
        return f"{self.author} — {preview}"

    @property
    def like_count(self):
        return self.likes.count()

    @property
    def comment_count(self):
        return self.comments.count()


class Comment(models.Model):
    """A comment on a post."""

    post   = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    content = models.TextField(max_length=1000)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name        = "Comment"
        verbose_name_plural = "Comments"

    def __str__(self):
        preview = self.content[:40] + ("…" if len(self.content) > 40 else "")
        return f"{self.author} on post #{self.post_id} — {preview}"


class Like(models.Model):
    """
    A student's like on a post. A real relationship, not a counter field,
    so we can compute has_liked per-request and prevent double-liking
    at the database level.
    """

    post    = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["post", "student"]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student} likes post #{self.post_id}"


class Report(models.Model):
    """
    A student's report of a post for moderation.
    Feeds the admin dashboard's "Reported Content" section.
    """

    SPAM          = "spam"
    ABUSE         = "abuse"
    INAPPROPRIATE = "inappropriate"
    OTHER         = "other"

    REASON_CHOICES = [
        (SPAM,          "Spam"),
        (ABUSE,         "Abuse"),
        (INAPPROPRIATE, "Inappropriate"),
        (OTHER,         "Other"),
    ]

    PENDING  = "pending"
    APPROVED = "approved"   # post reviewed and kept — report dismissed
    REMOVED  = "removed"    # post was deleted as a result of this report

    STATUS_CHOICES = [
        (PENDING,  "Pending"),
        (APPROVED, "Approved"),
        (REMOVED,  "Removed"),
    ]

    post   = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reports")
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reports_filed",
    )
    reason  = models.CharField(max_length=20, choices=REASON_CHOICES, default=OTHER)
    note    = models.TextField(blank=True, default="")
    status  = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["post", "reported_by"]  # one report per student per post
        ordering = ["-created_at"]
        verbose_name        = "Report"
        verbose_name_plural = "Reports"

    def __str__(self):
        return f"Report on post #{self.post_id} — {self.get_reason_display()} ({self.status})"
    



    