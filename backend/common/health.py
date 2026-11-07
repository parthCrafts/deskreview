"""Health check used by Render and uptime monitors."""

from django.db import connection
from django.http import JsonResponse


class HealthCheckMiddleware:
    """Answer /api/health before host validation, so platform probes on internal hosts pass."""

    def __init__(self, get_response):
        """Store the next handler in the chain."""
        self.get_response = get_response

    def __call__(self, request):
        """Short-circuit the health path; pass everything else through."""
        if request.path == "/api/health":
            return health(request)
        return self.get_response(request)


def health(request) -> JsonResponse:
    """Return ok when the app is up and the database answers SELECT 1."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "ok"
    except Exception:
        db_status = "error"
    status = 200 if db_status == "ok" else 503
    return JsonResponse(
        {"status": "ok" if status == 200 else "degraded", "db": db_status}, status=status
    )
