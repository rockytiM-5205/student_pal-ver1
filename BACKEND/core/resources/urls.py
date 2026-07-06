"""
resources/urls.py
All routes prefixed with /api/resources/ in the root urls.py
"""

from django.urls import path
from .views import ResourceListCreateView, ResourceDetailView, ResourceDownloadView

urlpatterns = [
    # GET  (list + filter)  |  POST (upload — admin only)
    path("",              ResourceListCreateView.as_view(), name="resource-list"),

    # GET (detail)  |  PATCH (edit)  |  DELETE
    path("<int:pk>/",    ResourceDetailView.as_view(),    name="resource-detail"),

    # GET — increment download count + return file URL
    path("<int:pk>/download/", ResourceDownloadView.as_view(), name="resource-download"),
]
