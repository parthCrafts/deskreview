"""The in-app admin role: sees everything, decides nothing."""

import pytest

from apps.assist.service import get_or_generate_assist
from common.errors import Forbidden

USERS_URL = "/api/v1/admin/users"


def test_admin_lists_users_with_activity(
    api_client, admin_user, submitter, other_submitter, reviewer, make_document, auth
):
    """Admins get every user with submission and review counts, admins first."""
    make_document(submitter, status="approved", decided_by=reviewer, comment=None)
    make_document(submitter, status="rejected", decided_by=reviewer, comment="Missing totals")
    make_document(submitter)
    make_document(other_submitter)
    r = auth(api_client, admin_user).get(USERS_URL)
    assert r.status_code == 200
    rows = {u["username"]: u for u in r.json()}
    assert [u["role"] for u in r.json()] == ["admin", "reviewer", "submitter", "submitter"]
    assert rows["alice"]["submissions"] == {"total": 3, "pending": 1, "approved": 1, "rejected": 1}
    assert rows["ben"]["submissions"]["total"] == 1
    assert rows["rita"]["reviews"] == {"total": 2, "approved": 1, "rejected": 1}
    assert rows["alice"]["reviews"]["total"] == 0
    assert {"display_name", "is_active", "last_login", "date_joined"} <= set(rows["alice"])
    assert "password" not in rows["alice"]


@pytest.mark.parametrize("who", ["submitter", "reviewer"])
def test_only_admins_list_users(api_client, auth, request, who):
    """Reviewers and submitters get 403; anonymous users get 401."""
    assert api_client.get(USERS_URL).status_code == 401
    r = auth(api_client, request.getfixturevalue(who)).get(USERS_URL)
    assert r.status_code == 403 and r.json()["error"]["code"] == "permission_denied"


def test_admin_sees_all_documents_with_decision_notes(
    api_client, admin_user, submitter, reviewer, make_document, auth
):
    """The admin's document list covers everyone, including who decided and why."""
    make_document(
        submitter, title="Budget", status="rejected", decided_by=reviewer, comment="No ROI"
    )
    make_document(reviewer, title="Reviewer's own")
    r = auth(api_client, admin_user).get("/api/v1/documents")
    body = r.json()
    assert r.status_code == 200 and body["counts"]["all"] == 2
    budget = next(d for d in body["results"] if d["title"] == "Budget")
    assert budget["decided_by"]["username"] == "rita"
    assert budget["decision_comment"] == "No ROI"


def test_admin_can_open_any_document_but_never_review(
    api_client, admin_user, submitter, make_document, auth
):
    """Admins read documents and timelines, but have no decision or AI path."""
    doc = make_document(submitter)
    client = auth(api_client, admin_user)
    detail = client.get(f"/api/v1/documents/{doc.id}").json()
    assert detail["can_review"] is False and len(detail["events"]) == 1
    r = client.post(f"/api/v1/documents/{doc.id}/review", {"decision": "approve"}, format="json")
    assert r.status_code == 403
    doc.refresh_from_db()
    assert doc.status == "pending"
    with pytest.raises(Forbidden):
        get_or_generate_assist(admin_user, str(doc.id))
