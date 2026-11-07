"""Request ID propagation and one structured access-log line per request."""

import logging
import re
import time
import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
access_log = logging.getLogger("deskreview.access")
_VALID_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class RequestIdMiddleware:
    """Attach a request ID to every request, response header and log line."""

    def __init__(self, get_response):
        """Store the next handler in the chain."""
        self.get_response = get_response

    def __call__(self, request):
        """Set the request ID, run the request, then log and echo it."""
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming if _VALID_ID.match(incoming) else uuid.uuid4().hex
        token = request_id_var.set(request_id)
        request.request_id = request_id
        started = time.perf_counter()
        try:
            response = self.get_response(request)
            response["X-Request-ID"] = request_id
            user = getattr(request, "user", None)
            access_log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                    "user_id": user.pk if user is not None and user.is_authenticated else None,
                },
            )
            return response
        finally:
            request_id_var.reset(token)
