from rest_framework import serializers
from .models import ChatSession
from notes.serializers import NoteSerializer

class ChatSessionSerializer(serializers.ModelSerializer):
    note = NoteSerializer(read_only=True)
    note_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = ChatSession
        fields = [
            'id', 'question', 'answer',
            'subject', 'note', 'note_id', 'created_at'
        ]
        read_only_fields = ['answer', 'created_at']


class AskQuestionSerializer(serializers.Serializer):
    question = serializers.CharField()
    subject = serializers.CharField(required=False, default='')
    note_id = serializers.IntegerField(required=False)