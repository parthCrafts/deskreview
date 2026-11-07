"""Document API routes. Ids are strings so malformed ones still get the 404 envelope."""

from django.urls import path

from apps.documents.api import views

urlpatterns = [
    path("documents", views.DocumentListCreateView.as_view(), name="document-list"),
    path("documents/<str:document_id>", views.DocumentDetailView.as_view(), name="document-detail"),
    path(
        "documents/<str:document_id>/file", views.DocumentFileView.as_view(), name="document-file"
    ),
    path(
        "documents/<str:document_id>/review",
        views.DocumentReviewView.as_view(),
        name="document-review",
    ),
]
