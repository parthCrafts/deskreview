import os

from django.core.management import call_command


def test_openapi_schema_valid(db):
    """The OpenAPI schema generates cleanly with no warnings."""
    call_command("spectacular", "--validate", "--fail-on-warn", "--file", os.devnull)


def test_docs_pages_served(client, db):
    """The schema and Swagger UI are reachable."""
    assert client.get("/api/schema").status_code == 200
    assert client.get("/api/docs").status_code == 200
