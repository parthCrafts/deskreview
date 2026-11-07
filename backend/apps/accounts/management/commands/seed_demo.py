"""Create or repair the demo users and sample documents (safe to run on every boot)."""

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.accounts.seed_data import DEMO_USERS, SAMPLE_DOCUMENTS
from apps.documents.domain import Decision, Status
from apps.documents.models import Document, DocumentEvent
from apps.documents.services import review_document, submit_document

MIN_PENDING = 3


def _purge_all_documents() -> None:
    """Delete every document, its events and stored files; the only bypass of append-only."""
    for name in Document.objects.exclude(file="").values_list("file", flat=True):
        default_storage.delete(name)
    DocumentEvent._base_manager.all()._raw_delete(DocumentEvent._base_manager.db)
    Document.objects.all().delete()


def _upsert_users() -> dict[str, User]:
    """Create or repair the demo users and return them by username."""
    users = {}
    for spec in DEMO_USERS:
        user, _ = User.objects.get_or_create(username=spec["username"])
        user.role = spec["role"]
        user.display_name = spec["display_name"]
        user.is_demo = True
        user.is_active = True
        if not user.check_password(settings.DEMO_PASSWORD):
            user.set_password(settings.DEMO_PASSWORD)
        user.save()
        users[user.username] = user
    return users


def _create_sample(sample: dict, users: dict[str, User]) -> None:
    """Create one sample through the real services so it gets a genuine timeline."""
    document = submit_document(
        users[sample["submitter"]], title=sample["title"], text=sample["text"], file=None
    )
    if sample["status"] != Status.PENDING:
        decision = Decision.APPROVE if sample["status"] == Status.APPROVED else Decision.REJECT
        review_document(
            users[sample["reviewer"]],
            str(document.id),
            decision=decision,
            comment=sample.get("comment"),
        )


class Command(BaseCommand):
    """Seed demo data; tops the pending queue back up to three on every run."""

    help = "Create demo users and sample documents. --reset wipes all documents first."

    def add_arguments(self, parser):
        """Accept --reset."""
        parser.add_argument("--reset", action="store_true", help="Delete all documents first.")

    @transaction.atomic
    def handle(self, *args, reset: bool = False, **options):
        """Upsert users, then seed all samples or top up pending ones."""
        if reset:
            _purge_all_documents()
        users = _upsert_users()
        if not Document.objects.exists():
            for sample in SAMPLE_DOCUMENTS:
                _create_sample(sample, users)
            self.stdout.write(f"Seeded {len(SAMPLE_DOCUMENTS)} sample documents.")
            return
        pending_titles = set(
            Document.objects.filter(status=Status.PENDING).values_list("title", flat=True)
        )
        added = 0
        for sample in SAMPLE_DOCUMENTS:
            if len(pending_titles) >= MIN_PENDING:
                break
            if sample["status"] == Status.PENDING and sample["title"] not in pending_titles:
                _create_sample(sample, users)
                pending_titles.add(sample["title"])
                added += 1
        self.stdout.write(f"Demo users ready; added {added} pending sample(s).")
