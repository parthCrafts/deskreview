"""Documents, their append-only event history, and DB-backed file blobs."""

from uuid import uuid4

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.documents.domain import Status


class Kind(models.TextChoices):
    """How the document's content was provided."""

    FILE = "file", "File"
    TEXT = "text", "Text"


class EventType(models.TextChoices):
    """What happened to a document."""

    SUBMITTED = "submitted", "Submitted"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


STATUS_CHOICES = [(s.value, s.value.title()) for s in Status]


def document_upload_path(instance, filename: str) -> str:
    """Return a random storage name using the sniffed extension, never the client's."""
    return f"documents/{uuid4().hex}{getattr(instance, '_sniffed_ext', '')}"


class Document(models.Model):
    """A submission awaiting or carrying a review decision."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="documents"
    )
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    body_text = models.TextField(null=True, blank=True)
    file = models.FileField(upload_to=document_upload_path, blank=True, max_length=255)
    original_filename = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=Status.PENDING)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="decisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_comment = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="doc_status_created_idx"),
            models.Index(fields=["submitter", "-created_at"], name="doc_submitter_created_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                name="doc_kind_text_has_body",
                condition=~Q(kind="text") | (Q(body_text__isnull=False) & Q(file="")),
            ),
            models.CheckConstraint(
                name="doc_kind_file_has_file",
                condition=~Q(kind="file") | (Q(body_text__isnull=True) & ~Q(file="")),
            ),
            models.CheckConstraint(
                name="doc_status_valid", condition=Q(status__in=[s.value for s in Status])
            ),
            models.CheckConstraint(
                name="doc_pending_iff_undecided",
                condition=(Q(status=Status.PENDING) & Q(decided_at__isnull=True))
                | (~Q(status=Status.PENDING) & Q(decided_at__isnull=False)),
            ),
            models.CheckConstraint(
                name="doc_rejected_has_comment",
                condition=~Q(status=Status.REJECTED)
                | (Q(decision_comment__isnull=False) & ~Q(decision_comment="")),
            ),
        ]

    def __str__(self) -> str:
        """Show the title."""
        return self.title


class AppendOnlyError(Exception):
    """Raised on any attempt to change or remove a recorded event."""


class AppendOnlyQuerySet(models.QuerySet):
    """A queryset that refuses bulk updates and deletes."""

    def update(self, **kwargs):
        """Refuse bulk updates."""
        raise AppendOnlyError("Document events are append-only.")

    def delete(self):
        """Refuse bulk deletes."""
        raise AppendOnlyError("Document events are append-only.")


class DocumentEvent(models.Model):
    """One immutable entry in a document's history; powers the timeline."""

    document = models.ForeignKey(Document, on_delete=models.PROTECT, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    type = models.CharField(max_length=30, choices=EventType.choices)
    from_status = models.CharField(max_length=20, null=True, blank=True)
    to_status = models.CharField(max_length=20)
    comment = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["document", "created_at"], name="event_doc_created_idx")]

    def __str__(self) -> str:
        """Show the event type."""
        return f"{self.type} ({self.created_at:%Y-%m-%d %H:%M})"

    def save(self, *args, **kwargs):
        """Insert only; an existing event can never be saved again."""
        if not self._state.adding:
            raise AppendOnlyError("Document events are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Refuse deletes."""
        raise AppendOnlyError("Document events are append-only.")


class StoredFile(models.Model):
    """A file blob kept in Postgres when FILE_STORAGE=database."""

    name = models.CharField(max_length=255, primary_key=True)
    data = models.BinaryField()
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        """Show the storage name."""
        return self.name
