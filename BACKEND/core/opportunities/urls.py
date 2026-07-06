"""
opportunities/urls.py
All routes prefixed with /api/opportunities/ in the root urls.py
"""

from django.urls import path
from .views import (
    OpportunityListCreateView,
    OpportunityDetailView,
    OpportunityApplyView,
    OpportunityApplicantsView,
)

urlpatterns = [
    # GET  (list + filter)  |  POST (create — admin only)
    path("", OpportunityListCreateView.as_view(), name="opportunity-list"),

    # GET (detail)  |  PATCH (edit)  |  DELETE  — admin only for write
    path("<int:pk>/", OpportunityDetailView.as_view(), name="opportunity-detail"),

    # POST — student applies
    path("<int:pk>/apply/", OpportunityApplyView.as_view(), name="opportunity-apply"),

    # GET — list applicants (admin only)
    path("<int:pk>/applicants/", OpportunityApplicantsView.as_view(), name="opportunity-applicants"),
]