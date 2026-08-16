"""
assignments/urls.py
All routes prefixed with /api/assignments/ in the root urls.py
"""

from django.urls import path
from .views import (
    AssignmentListCreateView,
    AssignmentDetailView,
    AssignmentSubmitView,
    AssignmentSubmissionsView,
)

urlpatterns = [
    # GET  (list + filter)  |  POST (create — admin only)
    path("", AssignmentListCreateView.as_view(), name="assignment-list"),

    # GET (detail)  |  PATCH (edit)  |  DELETE  — admin only for write
    path("<int:pk>/", AssignmentDetailView.as_view(), name="assignment-detail"),

    # POST — student submits a file
    path("<int:pk>/submit/", AssignmentSubmitView.as_view(), name="assignment-submit"),

    # GET — list submissions (admin only)
    path("<int:pk>/submissions/", AssignmentSubmissionsView.as_view(), name="assignment-submissions"),
]