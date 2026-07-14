"""
community/serializers.py
"""

from rest_framework import serializers
from .models import Post, Comment, Like, Report


# ── COMMENTS ────────────────────────────────────────────────────────────────

class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_initials = serializers.SerializerMethodField()
    author_department = serializers.CharField(source="author.department", read_only=True)

    class Meta:
        model  = Comment
        fields = [
            "id", "post", "content",
            "author_name", "author_initials", "author_department",
            "created_at",
        ]
        read_only_fields = ["id", "author_name", "author_initials", "author_department", "created_at"]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

    def get_author_initials(self, obj):
        first = (obj.author.first_name or "S")[:1]
        last  = (obj.author.last_name or "P")[:1]
        return (first + last).upper()


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Comment
        fields = ["content"]

    def validate_content(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Comment cannot be empty.")
        return value


# ── POSTS ───────────────────────────────────────────────────────────────────

class PostSerializer(serializers.ModelSerializer):
    """Used for listing and retrieving posts in the community feed."""

    author_name       = serializers.SerializerMethodField()
    author_initials   = serializers.SerializerMethodField()
    author_department = serializers.CharField(source="author.department", read_only=True)
    author_level      = serializers.CharField(source="author.level", read_only=True)

    like_count    = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    has_liked     = serializers.SerializerMethodField()
    is_owner      = serializers.SerializerMethodField()

    class Meta:
        model  = Post
        fields = [
            "id",
            "content",
            "author_name",
            "author_initials",
            "author_department",
            "author_level",
            "like_count",
            "comment_count",
            "has_liked",
            "is_owner",
            "is_hidden",
            "created_at",
        ]
        read_only_fields = [
            "id", "author_name", "author_initials", "author_department",
            "author_level", "like_count", "comment_count", "has_liked",
            "is_owner", "created_at",
        ]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

    def get_author_initials(self, obj):
        first = (obj.author.first_name or "S")[:1]
        last  = (obj.author.last_name or "P")[:1]
        return (first + last).upper()

    def get_has_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        # Uses prefetched likes if available (see view), falls back to a query.
        return obj.likes.filter(student=request.user).exists()

    def get_is_owner(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.author_id == request.user.id


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Post
        fields = ["content"]

    def validate_content(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Post cannot be empty.")
        if len(value) > 2000:
            raise serializers.ValidationError("Post is too long (max 2000 characters).")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        return Post.objects.create(author=user, **validated_data)


# ── REPORTS ─────────────────────────────────────────────────────────────────

class ReportSerializer(serializers.ModelSerializer):
    """Used by admins to review reported content."""

    post_content      = serializers.CharField(source="post.content", read_only=True)
    post_author_name  = serializers.SerializerMethodField()
    reported_by_name  = serializers.SerializerMethodField()
    reason_display    = serializers.CharField(source="get_reason_display", read_only=True)
    status_display    = serializers.CharField(source="get_status_display", read_only=True)
    report_count_on_post = serializers.SerializerMethodField()

    class Meta:
        model  = Report
        fields = [
            "id",
            "post",
            "post_content",
            "post_author_name",
            "reported_by_name",
            "reason",
            "reason_display",
            "note",
            "status",
            "status_display",
            "report_count_on_post",
            "created_at",
            "resolved_at",
        ]
        read_only_fields = [
            "id", "post_content", "post_author_name", "reported_by_name",
            "reason_display", "status_display", "report_count_on_post",
            "created_at", "resolved_at",
        ]

    def get_post_author_name(self, obj):
        return obj.post.author.get_full_name() or obj.post.author.username

    def get_reported_by_name(self, obj):
        return obj.reported_by.get_full_name() or obj.reported_by.username

    def get_report_count_on_post(self, obj):
        return obj.post.reports.count()


class ReportCreateSerializer(serializers.ModelSerializer):
    """Used by a student to file a report on a post."""

    class Meta:
        model  = Report
        fields = ["reason", "note"]

    def create(self, validated_data):
        user = self.context["request"].user
        post = self.context["post"]
        return Report.objects.create(post=post, reported_by=user, **validated_data)