"""Cached AI reports, keyed by exactly what was sent to the model."""

from django.db import models

from apps.documents.models import Document


class AssistResult(models.Model):
    """A successful, schema-valid report for one document version, prompt and model."""

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="assist_results")
    content_sha256 = models.CharField(max_length=64)
    prompt_version = models.CharField(max_length=20)
    provider = models.CharField(max_length=30)
    model = models.CharField(max_length=80)
    report = models.JSONField()
    created_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["document", "content_sha256", "prompt_version", "provider", "model"],
                name="assist_unique_cache_key",
            )
        ]

    def __str__(self) -> str:
        """Show which document and model this report is for."""
        return f"{self.document_id} ({self.provider}/{self.model})"
