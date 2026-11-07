"""Admin registration for users."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """User admin with the role fields exposed."""

    list_display = ("username", "display_name", "role", "is_demo", "is_staff")
    list_filter = ("role", "is_demo", "is_staff")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("DeskReview", {"fields": ("role", "display_name", "is_demo")}),
    )
