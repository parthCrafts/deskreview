"""Assist API routes."""

from django.urls import path

from apps.assist.api.views import DocumentAssistView

urlpatterns = [
    path(
        "documents/<str:document_id>/assist",
        DocumentAssistView.as_view(),
        name="document-assist",
    ),
]
