import re
from unittest.mock import Mock

import pytest
from django.db import DatabaseError

from apps.documents.models import Document, DocumentEvent
from tests.files import jpeg, pdf, png, upload

URL = "/api/v1/documents"


def post(client, data):
    """POST a multipart submission."""
    return client.post(URL, data, format="multipart")


def test_create_text(api_client, submitter, auth):
    """A text submission is created pending with a submitted event."""
    r = post(auth(api_client, submitter), {"title": " Policy ", "text": "Policy body text"})
    assert r.status_code == 201
    d = r.json()
    assert d["status"] == "pending" and d["kind"] == "text" and d["title"] == "Policy"
    assert d["text"] == "Policy body text" and d["file"] is None and d["can_review"] is False
    assert d["submitter"]["username"] == "alice"
    assert [e["type"] for e in d["events"]] == ["submitted"]
    assert d["events"][0]["to_status"] == "pending" and d["events"][0]["from_status"] is None


def test_create_text_json(api_client, submitter, auth):
    """JSON bodies work for text submissions."""
    r = auth(api_client, submitter).post(
        URL, {"title": "Test doc", "text": "Some body text"}, format="json"
    )
    assert r.status_code == 201


def test_create_file_stores_uuid_name(api_client, submitter, auth):
    """Files are stored under a random name with metadata from the bytes."""
    r = post(auth(api_client, submitter), {"title": "Scan", "file": upload("../x.pdf", pdf())})
    assert r.status_code == 201
    doc = Document.objects.get(id=r.json()["id"])
    assert re.fullmatch(r"documents/[0-9a-f]{32}\.pdf", doc.file.name)
    assert doc.original_filename == "x.pdf" and doc.content_type == "application/pdf"
    assert doc.size_bytes == 100 and len(doc.sha256) == 64 and doc.body_text is None
    f = r.json()["file"]
    assert f == {
        "name": "x.pdf",
        "content_type": "application/pdf",
        "size": 100,
        "url": f"/api/v1/documents/{doc.id}/file",
    }


@pytest.mark.parametrize(
    "name,data,ext", [("a.png", png(), ".png"), ("a.JPG", jpeg(), ".jpg"), ("n.md", b"# x", ".md")]
)
def test_create_each_type(api_client, submitter, auth, name, data, ext):
    """Every allowed type can be submitted."""
    r = post(auth(api_client, submitter), {"title": "Test doc", "file": upload(name, data)})
    assert r.status_code == 201
    assert Document.objects.get(id=r.json()["id"]).file.name.endswith(ext)


@pytest.mark.parametrize(
    "payload,field",
    [
        ({"title": "Test doc"}, "text"),
        ({"title": "", "text": "Some body text"}, "title"),
        ({"text": "Some body text"}, "title"),
        ({"title": "a" * 201, "text": "Some body text"}, "title"),
        ({"title": "Test doc", "text": "a" * 50_001}, "text"),
    ],
)
def test_create_400(api_client, submitter, auth, payload, field):
    """Invalid fields come back as a 400 with per-field messages."""
    r = post(auth(api_client, submitter), payload)
    assert r.status_code == 400 and r.json()["error"]["code"] == "validation_error"
    assert field in r.json()["error"]["fields"]


def test_create_both_400(api_client, submitter, auth):
    """Sending both text and a file is a 400 on both fields."""
    r = post(
        auth(api_client, submitter),
        {"title": "Test doc", "text": "Some body text", "file": upload("a.pdf", pdf())},
    )
    assert r.status_code == 400
    assert {"text", "file"} <= set(r.json()["error"]["fields"])
    assert r.json()["error"]["message"] == "Provide either a file or text, not both."


def test_create_empty_file_400(api_client, submitter, auth):
    """A zero-byte file is a 400 on the file field."""
    r = post(auth(api_client, submitter), {"title": "Test doc", "file": upload("a.pdf", b"")})
    assert r.status_code == 400 and r.json()["error"]["fields"]["file"] == ["File is empty."]


def test_create_oversized_413(api_client, submitter, auth, settings):
    """A file over the size cap is a 413 envelope."""
    settings.MAX_UPLOAD_MB = 1
    r = post(
        auth(api_client, submitter),
        {"title": "Test doc", "file": upload("a.pdf", pdf(1024 * 1024 + 1))},
    )
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"


def test_create_bad_type_415(api_client, submitter, auth):
    """A disallowed type is a 415 envelope."""
    r = post(auth(api_client, submitter), {"title": "Test doc", "file": upload("a.svg", b"<svg/>")})
    assert r.status_code == 415 and r.json()["error"]["code"] == "unsupported_media_type"


def test_create_mismatch_415(api_client, submitter, auth):
    """A file whose extension lies about its content is a 415."""
    r = post(auth(api_client, submitter), {"title": "Test doc", "file": upload("a.png", jpeg())})
    assert r.status_code == 415 and "does not match" in r.json()["error"]["message"]


def test_create_unauthenticated_401(api_client):
    """Anonymous submissions are a 401."""
    assert api_client.post(URL, {"title": "Test doc", "text": "Some body text"}).status_code == 401


def test_reviewer_can_submit(api_client, reviewer, auth):
    """Reviewers may submit their own documents."""
    assert (
        post(
            auth(api_client, reviewer), {"title": "Test doc", "text": "Some body text"}
        ).status_code
        == 201
    )


def test_upload_throttled_after_30(api_client, submitter, auth):
    """The 31st submission in an hour is throttled."""
    client = auth(api_client, submitter)
    for _ in range(30):
        assert post(client, {"title": "Test doc", "text": "Some body text"}).status_code == 201
    r = post(client, {"title": "Test doc", "text": "Some body text"})
    assert r.status_code == 429 and r.json()["error"]["code"] == "throttled"


def test_db_failure_cleans_up_file(api_client, submitter, auth, monkeypatch, settings):
    """If the database write fails, the stored file is removed."""
    monkeypatch.setattr(DocumentEvent.objects, "create", Mock(side_effect=DatabaseError))
    r = post(auth(api_client, submitter), {"title": "Test doc", "file": upload("a.pdf", pdf())})
    assert r.status_code == 500 and r.json()["error"]["code"] == "server_error"
    docs_dir = settings.MEDIA_ROOT / "documents"
    assert not docs_dir.exists() or not any(docs_dir.iterdir())
    assert Document.objects.count() == 0
