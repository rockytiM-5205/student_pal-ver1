from django.contrib import admin
from .models import ChatSession

@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'subject', 'created_at']
    list_filter = ['subject']
    search_fields = ['question', 'user__matric_number']