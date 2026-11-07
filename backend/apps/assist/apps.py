"""App config for AI Review Assist."""

from django.apps import AppConfig


class AssistConfig(AppConfig):
    """Advisory AI summaries for reviewers; it never changes document status."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.assist"
    label = "assist"
