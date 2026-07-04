import requests
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from .models import ChatSession
from .serializers import ChatSessionSerializer, AskQuestionSerializer
from notes.models import Note


def ask_gemini(question):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": question}]
        }]
    }
    response = requests.post(url, json=payload, timeout=30)
    data = response.json()

    try:
        return data['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError):
        return "Sorry, I could not generate a response. Please try again."


class AskAIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AskQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']
        subject = serializer.validated_data.get('subject', '')
        note_id = serializer.validated_data.get('note_id')

        # build prompt with context
        prompt = question
        if subject:
            prompt = f"You are a helpful study assistant for Nigerian university students. Subject: {subject}.\n\n{question}"
        else:
            prompt = f"You are a helpful study assistant for Nigerian university students studying Computer Science at AAUA.\n\n{question}"

        note = None
        if note_id:
            try:
                note = Note.objects.get(pk=note_id)
                prompt += f"\n\nThis question is about the course: {note.course_code} — {note.title}"
            except Note.DoesNotExist:
                pass

        answer = ask_gemini(prompt)

        # save session
        session = ChatSession.objects.create(
            user=request.user,
            question=question,
            answer=answer,
            subject=subject,
            note=note
        )

        return Response({
            'answer': answer,
            'session_id': session.id
        })


class ChatHistoryView(generics.ListAPIView):
    serializer_class = ChatSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChatSession.objects.filter(
            user=self.request.user
        ).order_by('-created_at')[:20]