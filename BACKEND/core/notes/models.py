from django.db import models
from accounts.models import User

class Note(models.Model):
    LEVEL_CHOICES = [
        ('100', '100 Level'),
        ('200', '200 Level'),
        ('300', '300 Level'),
        ('400', '400 Level'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    course_code = models.CharField(max_length=20)  # e.g. CSC 201
    level = models.CharField(max_length=3, choices=LEVEL_CHOICES)
    file = models.FileField(upload_to='notes/')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='uploaded_notes'
    )
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    view_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.course_code} — {self.title}"


class Bookmark(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='bookmarks'
    )
    note = models.ForeignKey(
        Note, on_delete=models.CASCADE, related_name='bookmarks'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'note')  # one bookmark per note per user

    def __str__(self):
        return f"{self.user.matric_number} bookmarked {self.note.title}"


class Download(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='downloads'
    )
    note = models.ForeignKey(
        Note, on_delete=models.CASCADE, related_name='downloads'
    )
    downloaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.matric_number} downloaded {self.note.title}"