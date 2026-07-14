"""
community/urls.py
All routes prefixed with /api/community/ in the root urls.py
"""

from django.urls import path
from .views import (
    PostListCreateView,
    PostDetailView,
    PostLikeView,
    CommentListCreateView,
    CommentDeleteView,
    PostReportView,
    ReportListView,
    ReportResolveView,
)

urlpatterns = [
    # ── Posts ────────────────────────────────────────────────────
    path("posts/", PostListCreateView.as_view(), name="post-list"),
    path("posts/<int:pk>/", PostDetailView.as_view(), name="post-detail"),

    # ── Likes ────────────────────────────────────────────────────
    path("posts/<int:pk>/like/", PostLikeView.as_view(), name="post-like"),

    # ── Comments ─────────────────────────────────────────────────
    path("posts/<int:pk>/comments/", CommentListCreateView.as_view(), name="comment-list"),
    path("comments/<int:pk>/", CommentDeleteView.as_view(), name="comment-delete"),

    # ── Reports (student files, admin resolves) ─────────────────
    path("posts/<int:pk>/report/", PostReportView.as_view(), name="post-report"),
    path("reports/", ReportListView.as_view(), name="report-list"),
    path("reports/<int:pk>/", ReportResolveView.as_view(), name="report-resolve"),
]