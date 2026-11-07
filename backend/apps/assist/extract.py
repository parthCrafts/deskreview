"""Turn a document into plain text for the model."""

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from apps.documents.models import Document, Kind


class UnsupportedContent(Exception):
    """The document has no text the model can read (e.g. an image or a scanned PDF)."""


def _pdf_text(document: Document, max_pages: int) -> tuple[str, bool]:
    """Extract text from the first pages of a PDF."""
    try:
        with document.file.open("rb") as handle:
            reader = PdfReader(handle)
            pages = reader.pages
            text = "\n\n".join((page.extract_text() or "") for page in pages[:max_pages])
            return text, len(pages) > max_pages
    except (PyPdfError, ValueError, OSError) as exc:
        raise UnsupportedContent("PDF could not be read") from exc


def extract_text(
    document: Document, max_chars: int = 20_000, max_pages: int = 20
) -> tuple[str, bool]:
    """Return (text, truncated) for text documents, .txt/.md files and PDFs."""
    truncated = False
    if document.kind == Kind.TEXT:
        text = document.body_text or ""
    elif document.content_type.startswith("text/"):
        with document.file.open("rb") as handle:
            text = handle.read().decode("utf-8")
    elif document.content_type == "application/pdf":
        text, truncated = _pdf_text(document, max_pages)
    else:
        raise UnsupportedContent(document.content_type)
    text = text.strip()
    if not text:
        raise UnsupportedContent("no extractable text")
    if len(text) > max_chars:
        return text[:max_chars], True
    return text, truncated
