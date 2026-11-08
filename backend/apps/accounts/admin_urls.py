"""Admin API routes (the in-app admin role, not Django's /admin site)."""

from django.urls import path

from apps.accounts import views

urlpatterns = [
    path("users", views.AdminUsersView.as_view(), name="admin-users"),
]
