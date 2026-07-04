from django.contrib import admin
from .models import Note, Bookmark, Download

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ['title', 'course_code', 'level', 'uploaded_by', 'created_at']
    list_filter = ['level', 'course_code']
    search_fields = ['title', 'course_code']

admin.site.register(Bookmark)
admin.site.register(Download)