"""Submission rules: title/content checks and magic-byte file inspection."""

import codecs
import hashlib
import os
import re
import unicodedata
from dataclasses import dataclass

from django.core.files.uploadedfile import UploadedFile

from common.errors import PayloadTooLarge, UnsupportedMedia, ValidationFailed

MAX_TITLE = 200
MAX_TEXT = 50_000
MAX_FILENAME = 255

ALLOWED: dict[str, tuple[str, frozenset[str]]] = {
    "pdf": ("application/pdf", frozenset({".pdf"})),
    "png": ("image/png", frozenset({".png"})),
    "jpeg": ("image/jpeg", frozenset({".jpg", ".jpeg"})),
    "text": ("text/plain", frozenset({".txt"})),
    "markdown": ("text/markdown", frozenset({".md"})),
}
_SIGNATURES = [(b"%PDF-", "pdf"), (b"\x89PNG\r\n\x1a\n", "png"), (b"\xff\xd8\xff", "jpeg")]
_TEXT_KINDS = {ext: kind for kind in ("text", "markdown") for ext in ALLOWED[kind][1]}
_BINARY_EXTS = {ext for kind in ("pdf", "png", "jpeg") for ext in ALLOWED[kind][1]}

MSG_UNSUPPORTED = "Unsupported file type. Allowed: PDF, PNG, JPEG, TXT, MD."
MSG_MISMATCH = "File extension does not match its content."
MSG_NOT_UTF8 = "Text files must be UTF-8."


@dataclass(frozen=True)
class FileInfo:
    """Server-derived facts about an accepted upload."""

    content_type: str
    extension: str
    size: int
    sha256: str
    original_filename: str


@dataclass(frozen=True)
class SubmissionInput:
    """A cleaned submission: a trimmed title and exactly one of text or file."""

    title: str
    text: str | None
    file: UploadedFile | None


def validate_submission(
    title: str | None, text: str | None, file: UploadedFile | None
) -> SubmissionInput:
    """Check title and content rules, raising one ValidationFailed with every field error."""
    fields: dict[str, list[str]] = {}
    message = None
    clean_title = (title or "").strip()
    if not clean_title:
        fields["title"] = ["Title is required."]
    elif len(clean_title) > MAX_TITLE:
        fields["title"] = [f"Title must be at most {MAX_TITLE} characters."]

    clean_text = (text or "").strip() or None
    if clean_text and file is not None:
        message = "Provide either a file or text, not both."
    elif not clean_text and file is None:
        message = "Provide a file or text."
    if message:
        fields["text"] = [message]
        fields["file"] = [message]
    elif clean_text and len(clean_text) > MAX_TEXT:
        fields["text"] = [f"Text must be at most {MAX_TEXT:,} characters."]
    elif file is not None and file.size == 0:
        fields["file"] = ["File is empty."]

    if fields:
        raise ValidationFailed(message, fields=fields)
    return SubmissionInput(title=clean_title, text=clean_text, file=file)


def sniff(head: bytes) -> str | None:
    """Return the ALLOWED key for a binary signature, or None if the bytes may be text."""
    for signature, kind in _SIGNATURES:
        if head.startswith(signature):
            return kind
    return None


def _is_utf8_text(file: UploadedFile) -> tuple[bool, bool]:
    """Return (decodes_as_utf8, contains_nul) for the whole file, reading in chunks."""
    decoder = codecs.getincrementaldecoder("utf-8")()
    has_nul = False
    file.seek(0)
    try:
        for chunk in file.chunks():
            has_nul = has_nul or b"\x00" in chunk
            decoder.decode(chunk)
        decoder.decode(b"", final=True)
    except UnicodeDecodeError:
        return False, has_nul
    return True, has_nul


def _digest(file: UploadedFile) -> str:
    """Return the SHA-256 hex digest of the whole file."""
    digest = hashlib.sha256()
    file.seek(0)
    for chunk in file.chunks():
        digest.update(chunk)
    file.seek(0)
    return digest.hexdigest()


def _classify_text(file: UploadedFile, extension: str) -> str:
    """Return the text kind for a file with no binary signature, or raise UnsupportedMedia."""
    is_utf8, has_nul = _is_utf8_text(file)
    if extension in _TEXT_KINDS:
        if has_nul:
            raise UnsupportedMedia(MSG_UNSUPPORTED)
        if not is_utf8:
            raise UnsupportedMedia(MSG_NOT_UTF8)
        return _TEXT_KINDS[extension]
    if is_utf8 and not has_nul and extension in _BINARY_EXTS:
        raise UnsupportedMedia(MSG_MISMATCH)
    raise UnsupportedMedia(MSG_UNSUPPORTED)


def inspect_file(file: UploadedFile, max_bytes: int) -> FileInfo:
    """Enforce size, type and extension rules from the file's bytes, never the client's claims."""
    if file.size > max_bytes:
        raise PayloadTooLarge(f"File must be at most {max_bytes // (1024 * 1024)} MB.")
    original_filename = sanitize_filename(file.name or "")
    extension = os.path.splitext(original_filename)[1].lower()
    file.seek(0)
    kind = sniff(file.read(16))
    if kind is None:
        kind = _classify_text(file, extension)
    elif extension not in ALLOWED[kind][1]:
        raise UnsupportedMedia(MSG_MISMATCH)
    return FileInfo(
        content_type=ALLOWED[kind][0],
        extension=extension,
        size=file.size,
        sha256=_digest(file),
        original_filename=original_filename,
    )


def sanitize_filename(name: str) -> str:
    """Reduce a client filename to a safe display basename of at most 255 characters."""
    base = name.replace("\\", "/").rsplit("/", 1)[-1]
    base = "".join(ch for ch in base if unicodedata.category(ch) not in {"Cc", "Cf"})
    base = re.sub(r"\s+", " ", base).strip().lstrip(".")
    if not base:
        return "file"
    if len(base) > MAX_FILENAME:
        stem, ext = os.path.splitext(base)
        ext = ext[:16]
        base = stem[: MAX_FILENAME - len(ext)] + ext
    return base
