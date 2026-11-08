import os
import threading

import pytest
from django.db import connection

from apps.documents.domain import Decision, Status
from apps.documents.models import DocumentEvent
from apps.documents.services import _apply_decision, review_document
from common.errors import Conflict


@pytest.fixture
def requires_postgres():
    """Skip at run time unless the test database is Postgres."""
    if connection.vendor != "postgresql":
        if os.environ.get("REQUIRE_POSTGRES"):
            pytest.fail("REQUIRE_POSTGRES is set but the test database is not Postgres")
        pytest.skip("true concurrency needs Postgres (SQLite serializes writers)")


def test_stale_read_loses_409(db, reviewer, reviewer2, submitter, make_document):
    """A reviewer acting on a stale pending read changes nothing."""
    doc = make_document(submitter)
    review_document(reviewer2, str(doc.id), decision=Decision.APPROVE, comment=None)
    assert _apply_decision(doc.id, Status.PENDING, Status.REJECTED, reviewer, "late") == 0
    doc.refresh_from_db()
    assert doc.status == "approved"
    assert doc.events.exclude(type="submitted").count() == 1


def test_stale_read_through_service_is_conflict(
    db, reviewer, reviewer2, submitter, make_document, monkeypatch
):
    """If another decision lands between read and write, the service raises Conflict."""
    from apps.documents import services

    doc = make_document(submitter)
    real_decide = services.decide

    def racing_decide(*args, **kwargs):
        """Let a second reviewer win after our read but before our conditional update."""
        monkeypatch.setattr(services, "decide", real_decide)
        review_document(reviewer2, str(doc.id), decision=Decision.APPROVE, comment=None)
        return real_decide(*args, **kwargs)

    monkeypatch.setattr(services, "decide", racing_decide)
    with pytest.raises(Conflict) as e:
        review_document(
            reviewer, str(doc.id), decision=Decision.REJECT, comment="Missing signature"
        )
    assert e.value.details["status"] == "approved" and e.value.details["decided_by"] == "Sam Lee"
    assert doc.events.exclude(type="submitted").count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_reviews_exactly_one_wins(
    requires_postgres, reviewer, reviewer2, submitter, make_document
):
    """Two reviewers deciding at once: exactly one wins, the other gets a conflict."""
    doc = make_document(submitter)
    barrier, results = threading.Barrier(2), []

    def run(actor, decision, comment):
        """Decide the document once both threads are ready."""
        barrier.wait()
        try:
            review_document(actor, str(doc.id), decision=decision, comment=comment)
            results.append("ok")
        except Conflict:
            results.append("conflict")
        finally:
            connection.close()

    threads = [
        threading.Thread(target=run, args=a)
        for a in [
            (reviewer, Decision.APPROVE, None),
            (reviewer2, Decision.REJECT, "Missing signature"),
        ]
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["conflict", "ok"]
    assert DocumentEvent.objects.filter(document=doc).exclude(type="submitted").count() == 1
