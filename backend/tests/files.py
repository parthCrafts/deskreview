"""Byte fixtures for upload tests."""

from django.core.files.uploadedfile import SimpleUploadedFile


def pdf(n: int = 100) -> bytes:
    """Return n bytes that start with a PDF signature."""
    head = b"%PDF-1.4\n"
    return head + b"0" * max(0, n - len(head))


def png() -> bytes:
    """Return bytes with a PNG signature."""
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def jpeg() -> bytes:
    """Return bytes with a JPEG signature."""
    return b"\xff\xd8\xff\xe0" + b"\x00" * 32


def upload(name: str, data: bytes, content_type: str = "application/octet-stream"):
    """Wrap bytes as an uploaded file."""
    return SimpleUploadedFile(name, data, content_type=content_type)
