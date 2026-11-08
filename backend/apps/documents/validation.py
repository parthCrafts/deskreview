"""Submission rules: title/content checks and magic-byte file inspection."""

import codecs
import hashlib
import os
import re
import unicodedata
from dataclasses import dataclass

from django.core.files.uploadedfile import UploadedFile

from apps.documents.domain import MAX_COMMENT_LENGTH
from common.errors import PayloadTooLarge, UnsupportedMedia, ValidationFailed

MIN_TITLE = 3
MAX_TITLE = 200
MAX_TITLE_WORD = 60
MIN_TEXT = 10
MAX_TEXT = 50_000
MAX_TEXT_WORD = 500
MAX_FILENAME = 255
MIN_REJECT_COMMENT = 10

# Control characters other than tab, newline and carriage return (e.g. NUL, backspace, ESC).
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_TITLE_BREAKS = re.compile(r"[\t\r\n]")
_ALNUM = re.compile(r"[^\W_]")  # any letter or digit, in any script

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


def _longest_word(text: str) -> int:
    """Length of the longest run of non-space characters."""
    return max((len(word) for word in text.split()), default=0)


def title_errors(title: str) -> list[str]:
    """Rule violations for an already-trimmed title (empty list when it is fine)."""
    if not title:
        return ["Title is required."]
    if len(title) > MAX_TITLE:
        return [f"Title must be at most {MAX_TITLE} characters."]
    if len(title) < MIN_TITLE:
        return [f"Title must be at least {MIN_TITLE} characters."]
    if _TITLE_BREAKS.search(title) or _CONTROL.search(title):
        return ["Title must be a single line without special control characters."]
    if not _ALNUM.search(title):
        return ["Title must include at least one letter or number."]
    if _longest_word(title) > MAX_TITLE_WORD:
        return [f"Title has a word longer than {MAX_TITLE_WORD} characters. Add spaces."]
    return []


def text_errors(text: str) -> list[str]:
    """Rule violations for already-trimmed, non-empty document text."""
    if len(text) > MAX_TEXT:
        return [f"Text must be at most {MAX_TEXT:,} characters."]
    if len(text) < MIN_TEXT:
        return [f"Text must be at least {MIN_TEXT} characters so a reviewer has something to read."]
    if _CONTROL.search(text):
        return ["Text contains control characters. Paste it as plain text."]
    if not _ALNUM.search(text):
        return ["Text must include letters or numbers."]
    if _longest_word(text) > MAX_TEXT_WORD:
        return [
            f"Text has an unbroken run longer than {MAX_TEXT_WORD} characters. "
            "Is it pasted data rather than a document?"
        ]
    return []


def comment_errors(comment: str, decision: str) -> list[str]:
    """Rule violations for a trimmed, non-empty review comment."""
    if len(comment) > MAX_COMMENT_LENGTH:
        return [f"Comment must be at most {MAX_COMMENT_LENGTH:,} characters."]
    if decision == "reject" and len(comment) < MIN_REJECT_COMMENT:
        return [f"Give the submitter a bit more detail: at least {MIN_REJECT_COMMENT} characters."]
    if _CONTROL.search(comment):
        return ["Comment contains control characters. Paste it as plain text."]
    return []


def validate_submission(
    title: str | None, text: str | None, file: UploadedFile | None
) -> SubmissionInput:
    """Check title and content rules, raising one ValidationFailed with every field error."""
    fields: dict[str, list[str]] = {}
    message = None
    clean_title = (title or "").strip()
    if problems := title_errors(clean_title):
        fields["title"] = problems

    clean_text = (text or "").strip() or None
    if clean_text and file is not None:
        message = "Provide either a file or text, not both."
    elif not clean_text and file is None:
        message = "Provide a file or text."
    if message:
        fields["text"] = [message]
        fields["file"] = [message]
    elif clean_text and (problems := text_errors(clean_text)):
        fields["text"] = problems
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
