from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from .models import Note, Bookmark, Download
from .serializers import NoteSerializer, NoteUploadSerializer, BookmarkSerializer
from accounts.models import User
from django.http import FileResponse
import os


# Custom permission — only reps and admins can upload
class IsRepOrAdmin(IsAuthenticated):
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view) and
            request.user.role in [User.REP, User.ADMIN]
        )


class NoteListView(generics.ListAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Note.objects.all()
        # admin with ?all=true sees everything
        show_all = self.request.query_params.get('all')
        if user.role == User.STUDENT or (user.role != User.ADMIN and not show_all):
            queryset = queryset.filter(is_approved=True)
        level = self.request.query_params.get('level')
        course_code = self.request.query_params.get('course_code')
        search = self.request.query_params.get('search')
        if level: queryset = queryset.filter(level=level)
        if course_code: queryset = queryset.filter(course_code__icontains=course_code)
        if search: queryset = queryset.filter(title__icontains=search)
        return queryset
    def get_serializer_context(self):
        return {'request': self.request}


# class NoteListView(generics.ListAPIView):
#     def get_queryset(self):
#         user = self.request.user
#         queryset = Note.objects.all()
#         # admins and reps see all, students only see approved
#         if user.role == User.STUDENT:
#             queryset = queryset.filter(is_approved=True)
#         # filters
#         level = self.request.query_params.get('level')
#         course_code = self.request.query_params.get('course_code')
#         search = self.request.query_params.get('search')
#         if level: queryset = queryset.filter(level=level)
#         if course_code: queryset = queryset.filter(course_code__icontains=course_code)
#         if search: queryset = queryset.filter(title__icontains=search)
#         return queryset




class NoteDetailView(generics.RetrieveAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        note = self.get_object()
        # increment view count
        note.view_count += 1
        note.save()
        serializer = self.get_serializer(note, context={'request': request})
        return Response(serializer.data)


class NoteUploadView(generics.CreateAPIView):
    serializer_class = NoteUploadSerializer
    permission_classes = [IsRepOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        note = Note.objects.filter(
            uploaded_by=request.user
        ).latest('created_at')
        return Response(
            NoteSerializer(note, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
class NoteDeleteView(generics.DestroyAPIView):
    queryset = Note.objects.all()
    permission_classes = [IsRepOrAdmin]

    def get_queryset(self):
        # reps can only delete their own notes
        user = self.request.user
        if user.role == User.ADMIN:
            return Note.objects.all()
        return Note.objects.filter(uploaded_by=user)


class BookmarkToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        note = get_object_or_404(Note, pk=pk)
        bookmark, created = Bookmark.objects.get_or_create(
            user=request.user, note=note
        )
        if not created:
            # already bookmarked — remove it
            bookmark.delete()
            return Response({'bookmarked': False})

        return Response({'bookmarked': True}, status=status.HTTP_201_CREATED)


class BookmarkListView(generics.ListAPIView):
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)



class NoteDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        note = get_object_or_404(Note, pk=pk)

        # track the download
        Download.objects.get_or_create(user=request.user, note=note)
        note.download_count += 1
        note.save()

        # serve the actual file
        file_path = note.file.path
        if not os.path.exists(file_path):
            return Response(
                {'error': 'File not found on server'},
                status=status.HTTP_404_NOT_FOUND
            )

        response = FileResponse(
            open(file_path, 'rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{os.path.basename(file_path)}"'
        return response


class NoteShareView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        note = get_object_or_404(Note, pk=pk)
        share_url = request.build_absolute_uri(f'/api/notes/{pk}/')
        return Response({
            'share_url': share_url,
            'title': note.title,
            'course_code': note.course_code,
            'level': note.level,
        })
    
class NoteApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != User.ADMIN:
            return Response({'error': 'Forbidden'}, status=403)
        note = get_object_or_404(Note, pk=pk)
        note.is_approved = True
        note.save()
        return Response({'message': 'Note approved'})


class NoteRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != User.ADMIN:
            return Response({'error': 'Forbidden'}, status=403)
        note = get_object_or_404(Note, pk=pk)
        note.delete()
        return Response({'message': 'Note rejected and deleted'})