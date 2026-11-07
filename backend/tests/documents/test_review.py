import pytest

from apps.documents.models import Document


def review(client, doc_id, decision="approve", comment=None):
    """POST a review decision."""
    payload = {"decision": decision}
    if comment is not None:
        payload["comment"] = comment
    return client.post(f"/api/v1/documents/{doc_id}/review", payload, format="json")


def test_approve(api_client, reviewer, submitter, make_document, auth):
    """Approving moves pending to approved and appends an event."""
    doc = make_document(submitter)
    r = review(auth(api_client, reviewer), doc.id)
    body = r.json()
    assert r.status_code == 200 and body["status"] == "approved"
    assert body["decided_by"]["username"] == "rita" and body["decided_at"]
    assert body["can_review"] is False and body["decision_comment"] is None
    assert [e["type"] for e in body["events"]] == ["submitted", "approved"]
    assert body["events"][1]["from_status"] == "pending"


def test_approve_with_optional_comment(api_client, reviewer, submitter, make_document, auth):
    """An approval may carry a comment."""
    doc = make_document(submitter)
    body = review(auth(api_client, reviewer), doc.id, "approve", "Looks good").json()
    assert body["decision_comment"] == "Looks good"


def test_reject_with_comment_trimmed(api_client, reviewer, submitter, make_document, auth):
    """Rejection comments are stored trimmed."""
    doc = make_document(submitter)
    body = review(auth(api_client, reviewer), doc.id, "reject", "  missing sig  ").json()
    assert body["status"] == "rejected" and body["decision_comment"] == "missing sig"
    assert body["events"][1]["comment"] == "missing sig"


@pytest.mark.parametrize("comment", [None, "", "   "])
def test_reject_without_comment_400(api_client, reviewer, submitter, make_document, auth, comment):
    """A rejection needs a comment; the document stays pending."""
    doc = make_document(submitter)
    r = review(auth(api_client, reviewer), doc.id, "reject", comment)
    assert r.status_code == 400
    assert r.json()["error"]["fields"]["comment"] == ["A comment is required to reject."]
    doc.refresh_from_db()
    assert doc.status == "pending"


def test_comment_too_long_400(api_client, reviewer, submitter, make_document, auth):
    """Comments are capped at 2,000 characters."""
    doc = make_document(submitter)
    r = review(auth(api_client, reviewer), doc.id, "reject", "x" * 2001)
    assert r.status_code == 400 and "comment" in r.json()["error"]["fields"]


def test_submitter_cannot_review_403(api_client, submitter, other_submitter, make_document, auth):
    """Submitters can't review, and the role check reveals nothing about the document."""
    doc = make_document(other_submitter)
    client = auth(api_client, submitter)
    r = review(client, doc.id)
    assert r.status_code == 403 and r.json()["error"]["code"] == "permission_denied"
    assert review(client, "00000000-0000-0000-0000-000000000000").status_code == 403


def test_self_review_403(api_client, reviewer, make_document, auth):
    """Reviewers can't decide their own submissions."""
    doc = make_document(reviewer)
    r = review(auth(api_client, reviewer), doc.id)
    assert r.status_code == 403 and r.json()["error"]["code"] == "self_review_forbidden"
    assert r.json()["error"]["message"] == "You can't review your own submission."


def test_already_decided_409(api_client, reviewer, reviewer2, submitter, make_document, auth):
    """Deciding a decided document is a 409 naming who decided it."""
    doc = make_document(submitter, status="approved", decided_by=reviewer2)
    r = review(auth(api_client, reviewer), doc.id, "reject", "no")
    err = r.json()["error"]
    assert r.status_code == 409 and err["code"] == "already_decided"
    assert err["details"]["status"] == "approved"
    assert err["details"]["decided_by"] == "Sam Lee" and err["details"]["decided_at"]
    assert err["message"] == "Already approved by Sam Lee."


def test_already_decided_beats_missing_comment(
    api_client, reviewer, reviewer2, submitter, make_document, auth
):
    """A late reject without a comment still learns the document was decided."""
    doc = make_document(submitter, status="approved", decided_by=reviewer2)
    assert review(auth(api_client, reviewer), doc.id, "reject", "").status_code == 409


@pytest.mark.parametrize("bad", ["nope", "00000000-0000-0000-0000-000000000000"])
def test_bad_id_404(api_client, reviewer, auth, bad):
    """Unknown or malformed ids are 404 for reviewers."""
    r = review(auth(api_client, reviewer), bad)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_invalid_decision_400(api_client, reviewer, submitter, make_document, auth):
    """Unknown decisions are field errors."""
    doc = make_document(submitter)
    r = review(auth(api_client, reviewer), doc.id, "maybe")
    assert r.status_code == 400 and "decision" in r.json()["error"]["fields"]


def test_status_not_writable(api_client, reviewer, submitter, make_document, auth):
    """There is no generic write path for status."""
    doc = make_document(submitter)
    c = auth(api_client, reviewer)
    for method in (c.patch, c.put, c.delete):
        assert (
            method(f"/api/v1/documents/{doc.id}", {"status": "approved"}, format="json").status_code
            == 405
        )
    doc.refresh_from_db()
    assert doc.status == "pending" and Document.objects.count() == 1


def test_review_requires_csrf_token(submitter, reviewer, make_document):
    """Session-authenticated review POSTs need a CSRF token."""
    from rest_framework.test import APIClient

    doc = make_document(submitter)
    c = APIClient(enforce_csrf_checks=True)
    c.force_login(reviewer)
    r = review(c, doc.id)
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"
