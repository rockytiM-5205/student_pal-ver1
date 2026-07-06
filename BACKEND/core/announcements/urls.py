"""
announcements/urls.py
All routes prefixed with /api/announcements/ in the root urls.py
"""

from django.urls import path
from .views import (
    AnnouncementListCreateView,
    AnnouncementDetailView,
    AnnouncementPublishView,
)

urlpatterns = [
    # GET  (list + filter, students see published only, admins can pass ?draft=true)
    # POST (create — admin only)
    path("", AnnouncementListCreateView.as_view(), name="announcement-list"),

    # GET (detail)  |  PATCH (edit)  |  DELETE  — admin only for write
    path("<int:pk>/", AnnouncementDetailView.as_view(), name="announcement-detail"),

    # PATCH — toggle is_published (admin only)
    path("<int:pk>/publish/", AnnouncementPublishView.as_view(), name="announcement-publish"),
]