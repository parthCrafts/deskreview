"""Document use cases. Every business rule and authorization decision lives here."""

import logging
import uuid

from django.conf import settings
from django.core.files import File
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Count, Prefetch, Q, QuerySet
from django.utils import timezone

from apps.accounts.models import User
from apps.documents.domain import (
    MAX_COMMENT_LENGTH,
    CommentRequired,
    Decision,
    InvalidTransition,
    Status,
    decide,
    event_type_for,
)
from apps.documents.models import Document, DocumentEvent, EventType, Kind
from apps.documents.validation import inspect_file, validate_submission
from common.errors import Conflict, Forbidden, NotFound, ValidationFailed

logger = logging.getLogger("deskreview.documents")


def can_review(actor: User, document: Document) -> bool:
    """Whether the actor may decide this document right now."""
    return (
        actor.is_reviewer
        and document.submitter_id != actor.pk
        and document.status == Status.PENDING
    )


def submit_document(
    actor: User, *, title: str | None, text: str | None, file: UploadedFile | None
) -> Document:
    """Validate and store a submission, recording its submitted event atomically."""
    data = validate_submission(title, text, file)
    info = inspect_file(data.file, settings.MAX_UPLOAD_MB * 1024 * 1024) if data.file else None
    document = Document(
        submitter=actor,
        title=data.title,
        kind=Kind.FILE if info else Kind.TEXT,
        body_text=data.text,
    )
    stored_name = None
    try:
        with transaction.atomic():
            if info:
                document._sniffed_ext = info.extension
                document.file.save(info.original_filename, data.file, save=False)
                stored_name = document.file.name
                document.original_filename = info.original_filename
                document.content_type = info.content_type
                document.size_bytes = info.size
                document.sha256 = info.sha256
            document.save()
            DocumentEvent.objects.create(
                document=document,
                actor=actor,
                type=EventType.SUBMITTED,
                from_status=None,
                to_status=Status.PENDING,
            )
    except Exception:
        if stored_name:
            document.file.storage.delete(stored_name)
        raise
    logger.info(
        "document.submitted",
        extra={"document_id": str(document.id), "kind": document.kind, "user_id": actor.pk},
    )
    return document


def visible_documents(actor: User) -> QuerySet[Document]:
    """Every document for reviewers; only their own for everyone else."""
    documents = Document.objects.all()
    return documents if actor.is_reviewer else documents.filter(submitter=actor)


def list_documents(
    actor: User, *, scope: str | None, status: Status | None, q: str
) -> tuple[QuerySet[Document], dict[str, int]]:
    """Return the visible documents matching the filters, plus per-status counts."""
    scope = scope or ("all" if actor.is_reviewer else "mine")
    documents = visible_documents(actor)
    if scope == "mine":
        documents = documents.filter(submitter=actor)
    if q:
        documents = documents.filter(
            Q(title__icontains=q)
            | Q(submitter__username__icontains=q)
            | Q(submitter__display_name__icontains=q)
        )
    counts = documents.aggregate(
        all=Count("id"), **{s.value: Count("id", filter=Q(status=s)) for s in Status}
    )
    if status:
        documents = documents.filter(status=status)
    return documents.select_related("submitter", "decided_by").order_by("-created_at"), counts


def _parse_id(document_id: str) -> uuid.UUID:
    """Parse a document id, treating anything malformed as not found."""
    try:
        return uuid.UUID(str(document_id))
    except ValueError:
        raise NotFound() from None


def get_document(actor: User, document_id: str) -> Document:
    """Return a visible document with its timeline, or raise NotFound."""
    events = Prefetch("events", queryset=DocumentEvent.objects.select_related("actor"))
    document = (
        visible_documents(actor)
        .select_related("submitter", "decided_by")
        .prefetch_related(events)
        .filter(id=_parse_id(document_id))
        .first()
    )
    if document is None:
        raise NotFound()
    return document


def open_document_file(actor: User, document_id: str) -> tuple[File, Document]:
    """Open a visible document's stored file, or raise NotFound."""
    document = visible_documents(actor).filter(id=_parse_id(document_id)).first()
    if document is None or document.kind != Kind.FILE or not document.file:
        raise NotFound()
    return document.file.open("rb"), document


def _conflict(document_id) -> Conflict:
    """Build a 409 describing the document's current decision, read fresh from the DB."""
    current = Document.objects.select_related("decided_by").get(id=document_id)
    decider = current.decided_by.display_name if current.decided_by else "another reviewer"
    return Conflict(
        f"Already {current.status} by {decider}.",
        details={
            "status": current.status,
            "decided_by": decider,
            "decided_at": current.decided_at.isoformat() if current.decided_at else None,
        },
    )


def _apply_decision(document_id, expected: Status, new: Status, actor: User, comment) -> int:
    """Conditionally write the decision; returns 0 if the status already moved on."""
    now = timezone.now()
    return Document.objects.filter(id=document_id, status=expected).update(
        status=new, decided_by=actor, decided_at=now, decision_comment=comment, updated_at=now
    )


def review_document(
    actor: User, document_id: str, *, decision: Decision, comment: str | None
) -> Document:
    """Approve or reject a pending document; the only code path that writes status."""
    if not actor.is_reviewer:
        raise Forbidden()
    document = visible_documents(actor).filter(id=_parse_id(document_id)).first()
    if document is None:
        raise NotFound()
    if document.submitter_id == actor.pk:
        raise Forbidden("You can't review your own submission.", code="self_review_forbidden")
    try:
        new_status = decide(Status(document.status), decision, comment)
    except CommentRequired:
        raise ValidationFailed(fields={"comment": ["A comment is required to reject."]}) from None
    except InvalidTransition:
        logger.info("review.conflict", extra={"document_id": str(document.id), "user_id": actor.pk})
        raise _conflict(document.id) from None
    clean_comment = (comment or "").strip() or None
    if clean_comment and len(clean_comment) > MAX_COMMENT_LENGTH:
        raise ValidationFailed(
            fields={"comment": [f"Comment must be at most {MAX_COMMENT_LENGTH:,} characters."]}
        )
    with transaction.atomic():
        if _apply_decision(document.id, Status.PENDING, new_status, actor, clean_comment) == 0:
            logger.info(
                "review.conflict", extra={"document_id": str(document.id), "user_id": actor.pk}
            )
            raise _conflict(document.id)
        DocumentEvent.objects.create(
            document_id=document.id,
            actor=actor,
            type=event_type_for(decision),
            from_status=Status.PENDING,
            to_status=new_status,
            comment=clean_comment,
        )
    logger.info(
        "document.reviewed",
        extra={"document_id": str(document.id), "decision": str(decision), "user_id": actor.pk},
    )
    return get_document(actor, str(document.id))
