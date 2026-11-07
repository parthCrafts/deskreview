"""Shared pytest fixtures."""

import pytest
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.documents.models import Document, DocumentEvent


def _user(username: str, display_name: str, role: str) -> User:
    """Create a demo user with password "pw"."""
    return User.objects.create_user(
        username, password="pw", role=role, display_name=display_name, is_demo=True
    )


@pytest.fixture
def api_client() -> APIClient:
    """A DRF test client."""
    return APIClient()


@pytest.fixture
def submitter(db) -> User:
    """Alice, a submitter."""
    return _user("alice", "Alice Chen", Role.SUBMITTER)


@pytest.fixture
def other_submitter(db) -> User:
    """Ben, a second submitter."""
    return _user("ben", "Ben Okafor", Role.SUBMITTER)


@pytest.fixture
def reviewer(db) -> User:
    """Rita, a reviewer."""
    return _user("rita", "Rita Shah", Role.REVIEWER)


@pytest.fixture
def reviewer2(db) -> User:
    """Sam, a second reviewer."""
    return _user("sam", "Sam Lee", Role.REVIEWER)


@pytest.fixture
def auth():
    """Return a helper that logs a user into a client."""

    def _auth(client, user):
        """Force-login `user` on `client` and return the client."""
        client.force_login(user)
        return client

    return _auth


@pytest.fixture(autouse=True)
def _locmem_cache(settings):
    """Use a fresh in-memory cache per test so throttles never leak between tests."""
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def media_tmp(settings, tmp_path):
    """Keep uploaded files in a per-test temp directory."""
    settings.MEDIA_ROOT = tmp_path / "media"


@pytest.fixture
def make_document(db):
    """Return a factory for documents with a consistent event history."""

    def _make(
        submitter,
        *,
        title="Doc",
        status="pending",
        kind="text",
        text="hello",
        decided_by=None,
        comment=None,
    ) -> Document:
        """Create a document plus its submitted event and, if decided, its decision event."""
        doc = Document(submitter=submitter, title=title, kind=kind, status=status)
        if kind == "file":
            doc._sniffed_ext = ".txt"
            data = text.encode()
            doc.file.save("note.txt", ContentFile(data), save=False)
            doc.original_filename, doc.content_type, doc.size_bytes = (
                "note.txt",
                "text/plain",
                len(data),
            )
        else:
            doc.body_text = text
        if status != "pending":
            doc.decided_by, doc.decided_at = decided_by, timezone.now()
            doc.decision_comment = comment or ("Needs changes." if status == "rejected" else None)
        doc.save()
        DocumentEvent.objects.create(
            document=doc, actor=submitter, type="submitted", from_status=None, to_status="pending"
        )
        if status != "pending":
            DocumentEvent.objects.create(
                document=doc,
                actor=decided_by,
                type=status,
                from_status="pending",
                to_status=status,
                comment=doc.decision_comment,
            )
        return doc

    return _make
