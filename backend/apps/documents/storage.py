"""Django Storage backed by the StoredFile table (Render's free disk is ephemeral)."""

from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class DatabaseStorage(Storage):
    """Store file bytes in Postgres; swap for S3 via STORAGES without code changes."""

    def _model(self):
        """Return the StoredFile model (imported lazily to avoid app-loading cycles)."""
        from apps.documents.models import StoredFile

        return StoredFile

    def _save(self, name: str, content) -> str:
        """Write the content under `name` and return the name."""
        content.seek(0)
        data = b"".join(content.chunks())
        self._model().objects.create(name=name, data=data, size=len(data))
        return name

    def _open(self, name: str, mode: str = "rb") -> ContentFile:
        """Return the stored bytes as a file object."""
        row = self._model().objects.filter(name=name).only("data").first()
        if row is None:
            raise FileNotFoundError(name)
        return ContentFile(bytes(row.data), name=name)

    def exists(self, name: str) -> bool:
        """Whether a blob with this name exists."""
        return self._model().objects.filter(name=name).exists()

    def delete(self, name: str) -> None:
        """Remove the blob if present."""
        self._model().objects.filter(name=name).delete()

    def size(self, name: str) -> int:
        """Return the stored size in bytes."""
        row = self._model().objects.filter(name=name).only("size").first()
        if row is None:
            raise FileNotFoundError(name)
        return row.size

    def url(self, name: str) -> str:
        """Files are only served through the authenticated download API."""
        raise NotImplementedError("Downloads go through /api/v1/documents/{id}/file.")
