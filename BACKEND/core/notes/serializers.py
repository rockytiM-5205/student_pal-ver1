from rest_framework import serializers
from .models import Note, Bookmark, Download
from accounts.serializers import UserSerializer

class NoteSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Note
        fields = [
            'id', 'title', 'description', 'course_code',
            'level', 'file', 'uploaded_by', 'created_at',
            'view_count', 'download_count', 'is_bookmarked', 'is_approved'
        ]
        read_only_fields = ['uploaded_by', 'view_count', 'download_count']

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Bookmark.objects.filter(
                user=request.user, note=obj
            ).exists()
        return False


class NoteUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['title', 'description', 'course_code', 'level', 'file']


class BookmarkSerializer(serializers.ModelSerializer):
    note = NoteSerializer(read_only=True)

    class Meta:
        model = Bookmark
        fields = ['id', 'note', 'created_at']