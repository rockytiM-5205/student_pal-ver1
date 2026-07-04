from django.db import models
from accounts.models import User
from notes.models import Note

class ChatSession(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='chat_sessions'
    )
    # optional — if the question is about a specific note
    note = models.ForeignKey(
        Note, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='chat_sessions'
    )
    question = models.TextField()
    answer = models.TextField()
    subject = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.matric_number} — {self.question[:50]}"