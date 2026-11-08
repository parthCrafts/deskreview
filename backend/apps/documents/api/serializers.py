"""Document API shapes. Serializers describe data only; rules live in services."""

from django.urls import reverse
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import User
from apps.documents import services
from apps.documents.domain import MAX_COMMENT_LENGTH, Decision
from apps.documents.models import STATUS_CHOICES, Document, DocumentEvent


class UserRefSerializer(serializers.ModelSerializer):
    """A compact user reference."""

    class Meta:
        model = User
        fields = ["id", "username", "display_name"]


class FileMetaSerializer(serializers.Serializer):
    """Metadata for a document's file, with its authenticated download URL."""

    name = serializers.CharField(source="original_filename")
    content_type = serializers.CharField()
    size = serializers.IntegerField(source="size_bytes")
    url = serializers.SerializerMethodField()

    def get_url(self, document: Document) -> str:
        """Return the download endpoint for this document."""
        return reverse("document-file", args=[document.id])


class EventSerializer(serializers.ModelSerializer):
    """One timeline entry."""

    actor = UserRefSerializer(allow_null=True)

    class Meta:
        model = DocumentEvent
        fields = ["id", "type", "actor", "from_status", "to_status", "comment", "created_at"]


class DocumentSummarySerializer(serializers.ModelSerializer):
    """A document as shown in lists (no body, no events), with its decision note."""

    submitter = UserRefSerializer()
    decided_by = UserRefSerializer(allow_null=True)
    file = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "kind",
            "status",
            "submitter",
            "file",
            "created_at",
            "decided_at",
            "decided_by",
            "decision_comment",
        ]

    @extend_schema_field(FileMetaSerializer(allow_null=True))
    def get_file(self, document: Document) -> dict | None:
        """Return file metadata for file documents, else null."""
        return FileMetaSerializer(document).data if document.kind == "file" else None


class DocumentDetailSerializer(DocumentSummarySerializer):
    """A document with its text, decision, timeline and what the viewer may do."""

    text = serializers.CharField(source="body_text", allow_null=True)
    can_review = serializers.SerializerMethodField()
    events = EventSerializer(many=True)

    class Meta(DocumentSummarySerializer.Meta):
        fields = DocumentSummarySerializer.Meta.fields + [
            "text",
            "can_review",
            "events",
        ]

    def get_can_review(self, document: Document) -> bool:
        """Whether the requesting user may review this document now."""
        return services.can_review(self.context["actor"], document)


class DocumentCreateSerializer(serializers.Serializer):
    """Shape of a submission: a title plus text or a file (rules are checked in the service)."""

    title = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    text = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, trim_whitespace=False
    )
    file = serializers.FileField(required=False, allow_null=True, allow_empty_file=True)


class ListQuerySerializer(serializers.Serializer):
    """Filters and paging for the document list."""

    scope = serializers.ChoiceField(choices=["mine", "all"], required=False)
    status = serializers.ChoiceField(choices=STATUS_CHOICES, required=False)
    q = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    page = serializers.IntegerField(min_value=1, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=50, default=20)


class CountsSerializer(serializers.Serializer):
    """Per-status totals for the current scope and search."""

    all = serializers.IntegerField()
    pending = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()


class DocumentPageSerializer(serializers.Serializer):
    """One page of documents (used for the OpenAPI schema)."""

    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    next = serializers.IntegerField(allow_null=True)
    previous = serializers.IntegerField(allow_null=True)
    counts = CountsSerializer()
    results = DocumentSummarySerializer(many=True)


class FileQuerySerializer(serializers.Serializer):
    """How the browser should treat a download."""

    disposition = serializers.ChoiceField(choices=["inline", "attachment"], default="attachment")


class ReviewSerializer(serializers.Serializer):
    """A reviewer's decision and optional comment (required for rejections, in the domain)."""

    decision = serializers.ChoiceField(choices=[d.value for d in Decision])
    comment = serializers.CharField(
        max_length=MAX_COMMENT_LENGTH, required=False, allow_blank=True, allow_null=True
    )
