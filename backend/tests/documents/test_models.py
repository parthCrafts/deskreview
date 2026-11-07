import pytest
from django.core.files.base import ContentFile
from django.db import IntegrityError
from django.utils import timezone

from apps.documents.models import AppendOnlyError, Document, DocumentEvent


def test_text_doc_requires_body(db, submitter):
    """A text document must have a body."""
    with pytest.raises(IntegrityError):
        Document.objects.create(submitter=submitter, title="t", kind="text", body_text=None)


def test_file_doc_requires_file(db, submitter):
    """A file document must have a stored file and no body."""
    with pytest.raises(IntegrityError):
        Document.objects.create(submitter=submitter, title="t", kind="file", body_text=None)


def test_text_doc_cannot_have_file(db, submitter):
    """A text document cannot also carry a file."""
    doc = Document(submitter=submitter, title="t", kind="text", body_text="x")
    doc._sniffed_ext = ".txt"
    doc.file.save("x.txt", ContentFile(b"x"), save=False)
    with pytest.raises(IntegrityError):
        doc.save()


def test_status_must_be_valid(db, submitter):
    """Status is limited to the known values."""
    with pytest.raises(IntegrityError):
        Document.objects.create(
            submitter=submitter, title="t", kind="text", body_text="x", status="archived"
        )


def test_rejected_requires_comment(db, submitter, reviewer):
    """A rejection must carry a comment."""
    with pytest.raises(IntegrityError):
        Document.objects.create(
            submitter=submitter,
            title="t",
            kind="text",
            body_text="x",
            status="rejected",
            decided_by=reviewer,
            decided_at=timezone.now(),
            decision_comment="",
        )


def test_pending_must_be_undecided(db, submitter):
    """A pending document has no decision timestamp."""
    with pytest.raises(IntegrityError):
        Document.objects.create(
            submitter=submitter, title="t", kind="text", body_text="x", decided_at=timezone.now()
        )


def test_decided_must_have_timestamp(db, submitter, reviewer):
    """A decided document has a decision timestamp."""
    with pytest.raises(IntegrityError):
        Document.objects.create(
            submitter=submitter,
            title="t",
            kind="text",
            body_text="x",
            status="approved",
            decided_by=reviewer,
        )


def test_upload_path_uses_uuid_and_sniffed_ext(db, submitter):
    """Stored names are random and use the server-sniffed extension."""
    doc = Document(submitter=submitter, title="t", kind="file")
    doc._sniffed_ext = ".pdf"
    doc.file.save("../../evil name.exe", ContentFile(b"%PDF-1.4"), save=False)
    name = doc.file.name
    assert name.startswith("documents/") and name.endswith(".pdf")
    assert len(name) == len("documents/") + 32 + 4


def test_make_document_records_events(db, submitter, reviewer, make_document):
    """The fixture creates a submitted event plus the decision event."""
    doc = make_document(submitter, status="rejected", decided_by=reviewer, comment="no")
    assert [e.type for e in doc.events.all()] == ["submitted", "rejected"]


def test_events_are_append_only(db, submitter, make_document):
    """Events can't be edited or deleted through the ORM."""
    ev = make_document(submitter).events.first()
    with pytest.raises(AppendOnlyError):
        ev.save()
    with pytest.raises(AppendOnlyError):
        ev.delete()
    with pytest.raises(AppendOnlyError):
        DocumentEvent.objects.all().update(comment="x")
    with pytest.raises(AppendOnlyError):
        DocumentEvent.objects.all().delete()
