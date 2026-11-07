import json
import logging

import pytest

from common.logging import JsonFormatter

pytestmark = pytest.mark.urls("tests.common.urls_errors")


def test_validation_envelope(client):
    """Serializer errors become a 400 envelope with field messages."""
    r = client.get("/raise/validation")
    body = r.json()
    assert r.status_code == 400
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["fields"] == {"title": ["Title is required."]}
    assert body["error"]["details"] == {}
    assert body["error"]["request_id"]


def test_unauthenticated_is_401(client):
    """Session auth's 403 for anonymous users is mapped to 401."""
    r = client.get("/raise/protected")
    assert r.status_code == 401 and r.json()["error"]["code"] == "not_authenticated"


def test_conflict_details(client):
    """Domain errors keep their status and details."""
    r = client.get("/raise/conflict")
    assert r.status_code == 409 and r.json()["error"]["details"] == {"status": "approved"}
    assert r.json()["error"]["code"] == "already_decided"


def test_unhandled_is_500_without_trace(client):
    """Unexpected errors return a generic 500 envelope with no stack trace."""
    client.raise_request_exception = False
    r = client.get("/raise/boom")
    assert r.status_code == 500 and r.json()["error"]["code"] == "server_error"
    assert "Traceback" not in r.content.decode() and "kaboom" not in r.content.decode()


def test_unknown_api_path_is_json_404(client):
    """Unknown API paths get the envelope, not an HTML page."""
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_request_id_echoed(client, db):
    """An incoming request ID is echoed back in the header and envelope."""
    r = client.get("/api/health", HTTP_X_REQUEST_ID="abc123")
    assert r["X-Request-ID"] == "abc123"
    r = client.get("/api/v1/nope", HTTP_X_REQUEST_ID="abc456")
    assert r.json()["error"]["request_id"] == "abc456"


def test_request_id_generated(client, db):
    """A request ID is generated when none is sent."""
    assert len(client.get("/api/health")["X-Request-ID"]) == 32


def test_json_formatter_includes_extras():
    """Log lines are single JSON objects carrying extra fields."""
    record = logging.LogRecord("x", logging.INFO, __file__, 1, "document.submitted", None, None)
    record.document_id = "d1"
    line = json.loads(JsonFormatter().format(record))
    assert line["msg"] == "document.submitted" and line["document_id"] == "d1"
    assert {"ts", "level", "logger", "request_id"} <= set(line)
