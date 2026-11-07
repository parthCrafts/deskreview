"""Read-only admin for documents and their audit trail."""

from django.contrib import admin

from apps.documents.models import Document, DocumentEvent


class ReadOnlyAdminMixin:
    """Disable add, change and delete in the admin."""

    def has_add_permission(self, request, obj=None) -> bool:
        """Nothing is created from the admin."""
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        """Nothing is edited from the admin."""
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        """Nothing is deleted from the admin."""
        return False


class DocumentEventInline(ReadOnlyAdminMixin, admin.TabularInline):
    """A document's history, shown inline."""

    model = DocumentEvent
    extra = 0
    fields = ("created_at", "type", "actor", "from_status", "to_status", "comment")
    readonly_fields = fields


@admin.register(Document)
class DocumentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Documents are changed only through the review service."""

    list_display = ("title", "kind", "status", "submitter", "created_at")
    list_filter = ("status", "kind")
    search_fields = ("title", "submitter__username")
    inlines = [DocumentEventInline]


@admin.register(DocumentEvent)
class DocumentEventAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """The append-only audit trail."""

    list_display = ("document", "type", "actor", "created_at")
    list_filter = ("type",)
