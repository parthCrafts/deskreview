from django.core.files.base import ContentFile

from apps.documents.storage import DatabaseStorage


def test_database_storage_roundtrip(db):
    """Files round-trip through Postgres-backed storage."""
    s = DatabaseStorage()
    name = s.save("documents/abc.pdf", ContentFile(b"%PDF-1.4 data"))
    assert name == "documents/abc.pdf"
    assert s.exists(name) and s.size(name) == 13
    with s.open(name) as f:
        assert f.read() == b"%PDF-1.4 data"
    s.delete(name)
    assert not s.exists(name)


def test_database_storage_avoids_name_collisions(db):
    """Saving the same name twice yields a different stored name."""
    s = DatabaseStorage()
    first = s.save("documents/a.txt", ContentFile(b"1"))
    second = s.save("documents/a.txt", ContentFile(b"2"))
    assert first != second
