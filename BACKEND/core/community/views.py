
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from accounts.permissions import IsAdminRole
from .models import Post, Comment, Like, Report
from .serializers import (
    PostSerializer, PostCreateSerializer,
    CommentSerializer, CommentCreateSerializer,
    ReportSerializer, ReportCreateSerializer,
)


# ── POSTS: LIST + CREATE ──────────────────────────────────────────────────────

class PostListCreateView(APIView):
    """
    GET  /api/community/posts/  — list posts, newest first.
        Students only see non-hidden posts.
        Admins can pass ?include_hidden=true to see moderated posts too.

    POST /api/community/posts/  — create a post.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Post.objects.select_related("author").prefetch_related("likes", "comments")

        is_admin = request.user.is_staff or getattr(request.user, "role", None) == "admin"
        if not (is_admin and request.query_params.get("include_hidden") == "true"):
            qs = qs.filter(is_hidden=False)

        serializer = PostSerializer(qs, many=True, context={"request": request})
        return Response({"count": qs.count(), "posts": serializer.data})

    def post(self, request):
        serializer = PostCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(
                {"message": "Failed to create post.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        post = serializer.save()
        return Response(
            {
                "message": "Post created successfully.",
                "post": PostSerializer(post, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── POSTS: RETRIEVE + DELETE ──────────────────────────────────────────────────

class PostDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Post.objects.select_related("author").get(pk=pk)
        except Post.DoesNotExist:
            return None

    def get(self, request, pk):
        post = self.get_object(pk)
        if not post:
            return Response({"message": "Post not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"post": PostSerializer(post, context={"request": request}).data})

    def delete(self, request, pk):
        post = self.get_object(pk)
        if not post:
            return Response({"message": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        is_admin = request.user.is_staff or getattr(request.user, "role", None) == "admin"
        is_owner = post.author_id == request.user.id

        if not (is_admin or is_owner):
            return Response(
                {"message": "You do not have permission to delete this post."},
                status=status.HTTP_403_FORBIDDEN,
            )

        post.delete()
        return Response({"message": "Post deleted."}, status=status.HTTP_200_OK)


# ── LIKES ─────────────────────────────────────────────────────────────────────

class PostLikeView(APIView):
    """
    POST /api/community/posts/<id>/like/
    Toggles the like — if already liked, unlikes; otherwise likes.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({"message": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        existing = Like.objects.filter(post=post, student=request.user).first()

        if existing:
            existing.delete()
            liked = False
            message = "Post unliked."
        else:
            Like.objects.create(post=post, student=request.user)
            liked = True
            message = "Post liked."

        return Response({
            "message":     message,
            "liked":       liked,
            "like_count":  post.like_count,
        })


# ── COMMENTS ──────────────────────────────────────────────────────────────────

class CommentListCreateView(APIView):
    """
    GET  /api/community/posts/<id>/comments/  — list comments on a post.
    POST /api/community/posts/<id>/comments/  — add a comment.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({"message": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        comments = post.comments.select_related("author")
        serializer = CommentSerializer(comments, many=True)
        return Response({"count": comments.count(), "comments": serializer.data})

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({"message": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CommentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"message": "Failed to add comment.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = Comment.objects.create(
            post=post, author=request.user, content=serializer.validated_data["content"]
        )

        return Response(
            {
                "message": "Comment added.",
                "comment": CommentSerializer(comment).data,
                "comment_count": post.comment_count,
            },
            status=status.HTTP_201_CREATED,
        )


class CommentDeleteView(APIView):
    """DELETE /api/community/comments/<id>/ — owner or admin only."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return Response({"message": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        is_admin = request.user.is_staff or getattr(request.user, "role", None) == "admin"
        is_owner = comment.author_id == request.user.id

        if not (is_admin or is_owner):
            return Response(
                {"message": "You do not have permission to delete this comment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        comment.delete()
        return Response({"message": "Comment deleted."}, status=status.HTTP_200_OK)


# ── REPORTS: FILE A REPORT (student) ──────────────────────────────────────────

class PostReportView(APIView):
    """
    POST /api/community/posts/<id>/report/
    Body: { "reason": "spam" | "abuse" | "inappropriate" | "other", "note": "..." }
    A student can only report a given post once (DB-enforced).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({"message": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        already_reported = Report.objects.filter(post=post, reported_by=request.user).exists()
        if already_reported:
            return Response(
                {"message": "You have already reported this post."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReportCreateSerializer(
            data=request.data, context={"request": request, "post": post}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Failed to submit report.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        report = serializer.save()

        return Response(
            {
                "message": "Post reported. Our moderation team will review it shortly.",
                "report": ReportSerializer(report).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── REPORTS: ADMIN MODERATION ─────────────────────────────────────────────────

class ReportListView(APIView):
    """
    GET /api/community/reports/  — list reports (admin only).
    Supports ?status=pending / ?reason=spam filters.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = Report.objects.select_related("post", "post__author", "reported_by")

        status_filter = request.query_params.get("status")
        reason_filter = request.query_params.get("reason")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if reason_filter:
            qs = qs.filter(reason=reason_filter)

        serializer = ReportSerializer(qs, many=True)
        return Response({"count": qs.count(), "reports": serializer.data})


class ReportResolveView(APIView):
    """
    PATCH /api/community/reports/<id>/
    Body: { "action": "approve" }  → dismiss report, keep post
           { "action": "remove" }  → delete the post, mark report removed

    Admin only.
    """
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        try:
            report = Report.objects.select_related("post").get(pk=pk)
        except Report.DoesNotExist:
            return Response({"message": "Report not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")

        if action == "approve":
            report.status = Report.APPROVED
            report.resolved_at = timezone.now()
            report.save()
            return Response({
                "message": "Report dismissed. Post remains published.",
                "report":  ReportSerializer(report).data,
            })

        if action == "remove":
            post = report.post
            post.delete()  # cascades: deletes comments, likes, and all reports on this post
            return Response({
                "message": "Post removed and report resolved.",
            })

        return Response(
            {"message": "Invalid action. Use 'approve' or 'remove'."},
            status=status.HTTP_400_BAD_REQUEST,
        )