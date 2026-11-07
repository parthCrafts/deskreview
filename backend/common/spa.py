"""Serve the built React app's index.html for client-side routes."""

from pathlib import Path

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def index(request) -> HttpResponse:
    """Return the SPA shell (never cached, so new deploys show up immediately)."""
    path = Path(settings.FRONTEND_DIST) / "index.html"
    if not path.is_file():
        return HttpResponseNotFound(
            "Frontend not built. Run `make build`.", content_type="text/plain"
        )
    response = HttpResponse(path.read_bytes(), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response
