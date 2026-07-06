from django.contrib import admin
from .models import Opportunity, Application


@admin.register(Opportunity)
class OpportunityAdmin(admin.ModelAdmin):
    list_display  = ("title", "opportunity_type", "organization", "deadline", "is_active", "applicant_count", "created_at")
    list_filter   = ("opportunity_type", "is_active")
    search_fields = ("title", "organization", "description")
    readonly_fields = ("created_at", "updated_at")
    ordering      = ("deadline",)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display  = ("student", "opportunity", "applied_at")
    list_filter   = ("opportunity",)
    search_fields = ("student__email", "student__username", "opportunity__title")
    readonly_fields = ("applied_at",)