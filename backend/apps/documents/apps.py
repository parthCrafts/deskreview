"""App config for documents."""

from django.apps import AppConfig


class DocumentsConfig(AppConfig):
    """Documents, review workflow and file storage."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.documents"
    label = "documents"
