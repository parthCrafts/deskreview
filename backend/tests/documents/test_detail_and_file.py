import pytest

from tests.files import pdf, upload


def detail(client, doc_id):
    """GET a document's detail."""
    return client.get(f"/api/v1/documents/{doc_id}")


def submit_pdf(client):
    """Submit a small PDF and return its id."""
    r = client.post(
        "/api/v1/documents",
        {"title": "Scan", "file": upload("re port.pdf", pdf())},
        format="multipart",
    )
    return r.json()["id"]


def test_detail_other_users_doc_404(api_client, submitter, other_submitter, make_document, auth):
    """Another user's document looks exactly like a missing one."""
    doc = make_document(other_submitter)
    r = detail(auth(api_client, submitter), doc.id)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("bad", ["123", "not-a-uuid", "00000000-0000-0000-0000-000000000000"])
def test_detail_bad_id_404(api_client, reviewer, auth, bad):
    """Malformed and unknown ids are 404 envelopes."""
    r = detail(auth(api_client, reviewer), bad)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_detail_includes_timeline_and_can_review(
    api_client, reviewer, submitter, make_document, auth
):
    """A reviewer sees the timeline and may review someone else's pending document."""
    doc = make_document(submitter, text="Body")
    d = detail(auth(api_client, reviewer), doc.id).json()
    assert d["can_review"] is True and d["text"] == "Body" and len(d["events"]) == 1
    assert d["events"][0]["actor"]["display_name"] == "Alice Chen"


def test_can_review_false_cases(api_client, reviewer, submitter, make_document, auth):
    """Owners, submitters and decided documents can't be reviewed."""
    own = make_document(reviewer)
    decided = make_document(submitter, status="approved", decided_by=reviewer)
    pending = make_document(submitter)
    client = auth(api_client, reviewer)
    assert detail(client, own.id).json()["can_review"] is False
    assert detail(client, decided.id).json()["can_review"] is False
    api_client.logout()
    assert detail(auth(api_client, submitter), pending.id).json()["can_review"] is False


def test_file_download_requires_auth(api_client, submitter, other_submitter, auth):
    """Downloads need a session and visibility."""
    doc_id = submit_pdf(auth(api_client, submitter))
    url = f"/api/v1/documents/{doc_id}/file"
    assert b"".join(api_client.get(url).streaming_content) == pdf()
    api_client.logout()
    assert api_client.get(url).status_code == 401
    assert auth(api_client, other_submitter).get(url).status_code == 404


def test_reviewer_can_download(api_client, submitter, reviewer, auth):
    """Reviewers can download any document's file."""
    doc_id = submit_pdf(auth(api_client, submitter))
    api_client.logout()
    assert auth(api_client, reviewer).get(f"/api/v1/documents/{doc_id}/file").status_code == 200


def test_file_headers(api_client, submitter, auth):
    """Downloads carry safe headers and honour the disposition parameter."""
    client = auth(api_client, submitter)
    doc_id = submit_pdf(client)
    r = client.get(f"/api/v1/documents/{doc_id}/file")
    assert r["Content-Type"] == "application/pdf"
    assert r["X-Content-Type-Options"] == "nosniff"
    assert r["Cache-Control"] == "private, no-store"
    assert r["Content-Disposition"].startswith("attachment")
    assert "re port.pdf" in r["Content-Disposition"]
    inline = client.get(f"/api/v1/documents/{doc_id}/file", {"disposition": "inline"})
    assert inline["Content-Disposition"].startswith("inline")


def test_file_bad_disposition_400(api_client, submitter, auth):
    """Unknown disposition values are rejected."""
    client = auth(api_client, submitter)
    doc_id = submit_pdf(client)
    r = client.get(f"/api/v1/documents/{doc_id}/file", {"disposition": "evil"})
    assert r.status_code == 400 and "disposition" in r.json()["error"]["fields"]


def test_file_on_text_doc_404(api_client, submitter, make_document, auth):
    """Text documents have no file."""
    doc = make_document(submitter)
    assert auth(api_client, submitter).get(f"/api/v1/documents/{doc.id}/file").status_code == 404


def test_file_bad_id_404(api_client, reviewer, auth):
    """A malformed id on the file route is a 404."""
    assert auth(api_client, reviewer).get("/api/v1/documents/nope/file").status_code == 404


@pytest.mark.parametrize(
    "method,suffix",
    [
        ("get", ""),
        ("get", "/file"),
        ("post", "/review"),
        ("post", "/assist"),
    ],
)
def test_every_endpoint_requires_auth(api_client, submitter, make_document, method, suffix):
    """Every document endpoint is a 401 without a session."""
    doc = make_document(submitter)
    r = getattr(api_client, method)(f"/api/v1/documents/{doc.id}{suffix}")
    assert r.status_code == 401 and r.json()["error"]["code"] == "not_authenticated"
