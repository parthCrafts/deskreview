from django.core.management import call_command

from apps.accounts.models import User
from apps.documents.domain import Decision
from apps.documents.models import Document, DocumentEvent
from apps.documents.services import review_document


def test_seed_creates_users_and_samples(db, settings):
    """The seed creates five demo users (one admin) and six documents across all statuses."""
    settings.DEMO_PASSWORD = "secret-demo"
    call_command("seed_demo")
    users = User.objects.filter(is_demo=True)
    assert set(users.values_list("username", flat=True)) == {"admin", "alice", "ben", "rita", "sam"}
    assert User.objects.get(username="rita").is_reviewer
    assert User.objects.get(username="admin").is_admin
    assert User.objects.get(username="alice").check_password("secret-demo")
    assert Document.objects.count() == 6
    assert Document.objects.filter(status="pending").count() == 3
    assert Document.objects.filter(status="approved").count() == 2
    assert Document.objects.filter(status="rejected").count() == 1
    assert Document.objects.filter(body_text__icontains="ignore all previous instructions").exists()


def test_seed_events_match_status(db):
    """Every seeded document has a consistent timeline."""
    call_command("seed_demo")
    for doc in Document.objects.all():
        types = list(doc.events.values_list("type", flat=True))
        assert types == ["submitted"] if doc.status == "pending" else ["submitted", doc.status]


def test_seed_is_idempotent(db):
    """Running the seed twice changes nothing."""
    call_command("seed_demo")
    call_command("seed_demo")
    assert Document.objects.count() == 6 and User.objects.filter(is_demo=True).count() == 5


def test_seed_repairs_demo_users(db):
    """The seed restores a demo user's role and name."""
    call_command("seed_demo")
    User.objects.filter(username="rita").update(role="submitter", display_name="x")
    call_command("seed_demo")
    rita = User.objects.get(username="rita")
    assert rita.is_reviewer and rita.display_name == "Rita Shah"


def test_seed_tops_up_pending(db):
    """When reviewers clear the queue, the next boot refills it to three."""
    call_command("seed_demo")
    rita = User.objects.get(username="rita")
    for d in Document.objects.filter(status="pending"):
        review_document(rita, str(d.id), decision=Decision.APPROVE, comment=None)
    call_command("seed_demo")
    assert Document.objects.filter(status="pending").count() == 3
    titles = list(Document.objects.filter(status="pending").values_list("title", flat=True))
    assert len(titles) == len(set(titles))


def test_seed_reset(db):
    """--reset wipes documents and events, then reseeds."""
    call_command("seed_demo")
    call_command("seed_demo", reset=True)
    assert Document.objects.count() == 6
    assert DocumentEvent.objects.filter(type="submitted").count() == 6


def test_reseed_keeps_password_hash_so_sessions_survive_restarts(db):
    """Re-running the seed on boot must not rotate the hash (it would log every demo user out)."""
    call_command("seed_demo")
    before = User.objects.get(username="rita").password
    call_command("seed_demo")
    assert User.objects.get(username="rita").password == before
