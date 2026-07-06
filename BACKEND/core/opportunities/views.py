"""
opportunities/views.py

Endpoints
---------
GET    /api/opportunities/                 List opportunities (filterable)
POST   /api/opportunities/                 Create opportunity (admin only)
GET    /api/opportunities/<id>/            Retrieve a single opportunity
PATCH  /api/opportunities/<id>/            Update opportunity (admin only)
DELETE /api/opportunities/<id>/            Delete opportunity (admin only)
POST   /api/opportunities/<id>/apply/      Student applies to an opportunity
GET    /api/opportunities/<id>/applicants/ List applicants (admin only)
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsAdminRole
from .models import Opportunity, Application
from .serializers import (
    OpportunitySerializer,
    OpportunityCreateSerializer,
    ApplicationSerializer,
)


# ── LIST + CREATE ─────────────────────────────────────────────────────────────

class OpportunityListCreateView(APIView):
    """
    GET  /api/opportunities/  — list with optional filters:
        ?opportunity_type=scholarship
        ?search=mtn
        ?active=true            (only non-expired, is_active opportunities)

    POST /api/opportunities/  — create (admin only)
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get(self, request):
        qs = Opportunity.objects.all()

        otype  = request.query_params.get("opportunity_type")
        search = request.query_params.get("search", "").strip()
        active_only = request.query_params.get("active")

        if otype:
            qs = qs.filter(opportunity_type=otype)
        if search:
            qs = qs.filter(title__icontains=search) | \
                 qs.filter(description__icontains=search) | \
                 qs.filter(organization__icontains=search)
        if active_only == "true":
            from django.utils import timezone
            qs = qs.filter(is_active=True, deadline__gte=timezone.now().date())

        qs = qs.distinct()
        serializer = OpportunitySerializer(qs, many=True, context={"request": request})
        return Response({
            "count":         qs.count(),
            "opportunities": serializer.data,
        })

    def post(self, request):
        serializer = OpportunityCreateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Failed to create opportunity.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        opportunity = serializer.save()
        return Response(
            {
                "message":     "Opportunity created successfully.",
                "opportunity": OpportunitySerializer(
                    opportunity, context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── RETRIEVE + UPDATE + DELETE ────────────────────────────────────────────────

class OpportunityDetailView(APIView):

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get_object(self, pk):
        try:
            return Opportunity.objects.get(pk=pk)
        except Opportunity.DoesNotExist:
            return None

    def get(self, request, pk):
        opp = self.get_object(pk)
        if not opp:
            return Response(
                {"message": "Opportunity not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = OpportunitySerializer(opp, context={"request": request})
        return Response({"opportunity": serializer.data})

    def patch(self, request, pk):
        opp = self.get_object(pk)
        if not opp:
            return Response(
                {"message": "Opportunity not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = OpportunityCreateSerializer(
            opp, data=request.data, partial=True, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(
                {"message": "Update failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response({
            "message":     "Opportunity updated.",
            "opportunity": OpportunitySerializer(opp, context={"request": request}).data,
        })

    def delete(self, request, pk):
        opp = self.get_object(pk)
        if not opp:
            return Response(
                {"message": "Opportunity not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        opp.delete()
        return Response({"message": "Opportunity deleted."}, status=status.HTTP_200_OK)


# ── APPLY ─────────────────────────────────────────────────────────────────────

class OpportunityApplyView(APIView):
    """
    POST /api/opportunities/<id>/apply/
    Student applies to an opportunity. One application per student
    per opportunity — enforced by the model's unique_together.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            opp = Opportunity.objects.get(pk=pk)
        except Opportunity.DoesNotExist:
            return Response(
                {"message": "Opportunity not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if opp.is_expired:
            return Response(
                {"message": "This opportunity's deadline has passed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not opp.is_active:
            return Response(
                {"message": "This opportunity is no longer accepting applications."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        already_applied = Application.objects.filter(
            opportunity=opp, student=request.user
        ).exists()

        if already_applied:
            return Response(
                {"message": "You have already applied to this opportunity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Application.objects.create(opportunity=opp, student=request.user)

        return Response(
            {
                "message":     f"Application submitted successfully for {opp.title}.",
                "opportunity": OpportunitySerializer(opp, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── APPLICANTS (admin only) ───────────────────────────────────────────────────

class OpportunityApplicantsView(APIView):
    """
    GET /api/opportunities/<id>/applicants/
    Returns the list of students who applied — admin only.
    """
    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        try:
            opp = Opportunity.objects.get(pk=pk)
        except Opportunity.DoesNotExist:
            return Response(
                {"message": "Opportunity not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        applications = opp.applications.select_related("student").all()
        serializer = ApplicationSerializer(applications, many=True)
        return Response({
            "opportunity_title": opp.title,
            "count":             applications.count(),
            "applicants":        serializer.data,
        })