import pytest

from apps.documents.validation import inspect_file, sanitize_filename, validate_submission
from common.errors import PayloadTooLarge, UnsupportedMedia, ValidationFailed
from tests.files import jpeg, pdf, png, upload

MAX = 5 * 1024 * 1024


def test_title_blank_and_too_long():
    """Titles are required and capped at 200 characters."""
    with pytest.raises(ValidationFailed) as e:
        validate_submission("   ", "Some body text", None)
    assert e.value.fields["title"] == ["Title is required."]
    with pytest.raises(ValidationFailed) as e:
        validate_submission("a" * 201, "Some body text", None)
    assert e.value.fields["title"] == ["Title must be at most 200 characters."]


def test_title_200_ok_and_trimmed():
    """A 200-char title is fine and surrounding whitespace is dropped."""
    assert validate_submission("  Hello  ", "Some body text", None).title == "Hello"
    title = ("abcdefghi " * 20)[:199] + "z"
    assert len(title) == 200
    assert validate_submission(title, "Some body text", None).title == title


@pytest.mark.parametrize("text,has_file", [(None, False), ("", False), ("hi", True)])
def test_neither_or_both(text, has_file):
    """Exactly one of text or file is required."""
    f = upload("a.pdf", pdf()) if has_file else None
    with pytest.raises(ValidationFailed) as e:
        validate_submission("Test doc", text, f)
    assert {"text", "file"} <= set(e.value.fields)
    expected = "Provide either a file or text, not both." if has_file else "Provide a file or text."
    assert e.value.message == expected


def test_errors_collected_together():
    """Every field error is reported at once."""
    with pytest.raises(ValidationFailed) as e:
        validate_submission("", None, None)
    assert {"title", "text", "file"} <= set(e.value.fields)


def test_blank_text_with_whitespace():
    """Whitespace-only text counts as no text."""
    with pytest.raises(ValidationFailed) as e:
        validate_submission("Test doc", "   \n ", None)
    assert "text" in e.value.fields


def test_text_too_long():
    """Text is capped at 50,000 characters after trimming."""
    with pytest.raises(ValidationFailed) as e:
        validate_submission("Test doc", "a" * 50_001, None)
    assert e.value.fields["text"] == ["Text must be at most 50,000 characters."]
    text = ("abcdefghi " * 5000)[:49_999] + "z"
    assert validate_submission("Test doc", f"  {text} \n", None).text == text


@pytest.mark.parametrize(
    "title,message",
    [
        ("ab", "Title must be at least 3 characters."),
        ("  ab  ", "Title must be at least 3 characters."),
        ("Line one\nline two", "Title must be a single line without special control characters."),
        ("Bad\x00title", "Title must be a single line without special control characters."),
        ("!!! --- ???", "Title must include at least one letter or number."),
        ("a" * 61, "Title has a word longer than 60 characters. Add spaces."),
    ],
)
def test_title_rules(title, message):
    """Titles need a few real characters on one line, without absurdly long words."""
    with pytest.raises(ValidationFailed) as e:
        validate_submission(title, "Some body text", None)
    assert e.value.fields["title"] == [message]


def test_title_rules_accept_unicode_and_emoji():
    """Non-Latin scripts, emoji and 60-character words are fine."""
    for title in ("Résumé für Q3", "契約書 第2版", "🚀 Launch plan", "x" * 60):
        assert validate_submission(title, "Some body text", None).title == title


@pytest.mark.parametrize(
    "text,message",
    [
        ("Too short", "Text must be at least 10 characters so a reviewer has something to read."),
        (
            "Hello\x00world, how are you",
            "Text contains control characters. Paste it as plain text.",
        ),
        ("Bell\x07 character here", "Text contains control characters. Paste it as plain text."),
        ("!!!!!!!!!!!! ??????", "Text must include letters or numbers."),
        (
            "Intro " + "A" * 501,
            "Text has an unbroken run longer than 500 characters. "
            "Is it pasted data rather than a document?",
        ),
    ],
)
def test_text_rules(text, message):
    """Text must be a readable document: long enough, no control characters, no data blobs."""
    with pytest.raises(ValidationFailed) as e:
        validate_submission("Test doc", text, None)
    assert e.value.fields["text"] == [message]


def test_text_rules_allow_tabs_newlines_and_long_urls():
    """Ordinary formatting and a long-ish URL are fine."""
    text = "Line one\n\tIndented line\r\nSee https://example.com/" + "p" * 400
    assert validate_submission("Test doc", text, None).text == text


def test_empty_file():
    """A zero-byte file is a field error."""
    with pytest.raises(ValidationFailed) as e:
        validate_submission("Test doc", None, upload("a.pdf", b""))
    assert e.value.fields["file"] == ["File is empty."]


def test_oversized_413():
    """Files over the limit are 413."""
    with pytest.raises(PayloadTooLarge, match="at most 5 MB"):
        inspect_file(upload("a.pdf", pdf(MAX + 1)), MAX)
    assert inspect_file(upload("a.pdf", pdf(MAX)), MAX).size == MAX


@pytest.mark.parametrize(
    "name,data",
    [("a.exe", b"MZ\x90\x00"), ("a.svg", b"<svg/>"), ("a.html", b"<html>"), ("a.bin", b"\x00\x01")],
)
def test_unsupported_415(name, data):
    """Anything outside the allow-list is 415."""
    with pytest.raises(UnsupportedMedia, match="Unsupported file type"):
        inspect_file(upload(name, data), MAX)


@pytest.mark.parametrize(
    "name,data", [("a.png", jpeg()), ("a.pdf", b"hello"), ("a.txt", pdf()), ("a", pdf())]
)
def test_extension_mismatch_415(name, data):
    """The extension must agree with the sniffed content."""
    with pytest.raises(UnsupportedMedia, match="does not match"):
        inspect_file(upload(name, data), MAX)


def test_latin1_text_415():
    """Text files that aren't UTF-8 are 415 with a clear message."""
    with pytest.raises(UnsupportedMedia, match="UTF-8"):
        inspect_file(upload("a.txt", "café".encode("latin-1")), MAX)


def test_text_with_nul_415():
    """NUL bytes mean the file isn't text."""
    with pytest.raises(UnsupportedMedia):
        inspect_file(upload("a.txt", b"hi\x00there"), MAX)


@pytest.mark.parametrize(
    "name,data,ctype",
    [
        ("a.pdf", pdf(), "application/pdf"),
        ("a.png", png(), "image/png"),
        ("a.JPG", jpeg(), "image/jpeg"),
        ("a.jpeg", jpeg(), "image/jpeg"),
        ("a.txt", "héllo".encode(), "text/plain"),
        ("a.md", b"# hi", "text/markdown"),
    ],
)
def test_allowed_types(name, data, ctype):
    """Each allowed type is accepted with server-derived metadata."""
    info = inspect_file(upload(name, data, "application/x-whatever"), MAX)
    assert info.content_type == ctype and info.size == len(data) and len(info.sha256) == 64
    assert info.extension == "." + name.rsplit(".", 1)[1].lower()


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("../../etc/passwd.pdf", "passwd.pdf"),
        ("C:\\Users\\x\\report.pdf", "report.pdf"),
        ("a\u202egnp.pdf", "agnp.pdf"),
        ("bad\x00\x1fname.pdf", "badname.pdf"),
        ("  spaced   out .pdf ", "spaced out .pdf"),
        ("", "file"),
        ("...", "file"),
    ],
)
def test_sanitize_filename(raw, expected):
    """Filenames are reduced to a safe display basename."""
    assert sanitize_filename(raw) == expected


def test_sanitize_long_name_keeps_extension():
    """Long names are truncated but keep their extension."""
    out = sanitize_filename("x" * 300 + ".pdf")
    assert len(out) <= 255 and out.endswith(".pdf")
