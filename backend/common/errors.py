"""Domain exceptions and the single mapping from exceptions to the error envelope."""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404, JsonResponse
from django.views import defaults
from drf_spectacular.utils import extend_schema
from rest_framework import exceptions as drf
from rest_framework import serializers
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.middleware import request_id_var

logger = logging.getLogger("deskreview.errors")


class AppError(Exception):
    """Base class for errors that map directly to an HTTP status and code."""

    status = 400
    code = "error"
    message = "Something went wrong."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        fields: dict[str, list[str]] | None = None,
        details: dict | None = None,
    ):
        """Override the class defaults for this instance."""
        self.message = message or self.message
        self.code = code or self.code
        self.fields = fields or {}
        self.details = details or {}
        super().__init__(self.message)


class ValidationFailed(AppError):
    """Input failed validation."""

    status, code, message = 400, "validation_error", "Please fix the highlighted fields."


class InvalidCredentials(AppError):
    """Username or password is wrong."""

    status, code, message = 400, "invalid_credentials", "Invalid username or password."


class Forbidden(AppError):
    """The user may not perform this action."""

    status, code, message = 403, "permission_denied", "You don't have permission to do that."


class NotFound(AppError):
    """The resource does not exist or is not visible to this user."""

    status, code, message = 404, "not_found", "Not found."


class Conflict(AppError):
    """The resource changed state before this request could apply."""

    status, code, message = 409, "already_decided", "This document has already been decided."


class PayloadTooLarge(AppError):
    """The uploaded file is too large."""

    status, code, message = 413, "file_too_large", "File is too large."


class UnsupportedMedia(AppError):
    """The uploaded file type is not allowed."""

    status, code, message = 415, "unsupported_media_type", "This file type is not supported."


def error_body(status: int, code: str, message: str, fields=None, details=None) -> dict:
    """Build the error envelope for a response."""
    return {
        "error": {
            "code": code,
            "message": message,
            "fields": fields or {},
            "details": details or {},
            "request_id": request_id_var.get(),
        }
    }


def _flatten(detail) -> list[str]:
    """Turn a DRF error detail (string, list or dict) into a list of strings."""
    if isinstance(detail, dict):
        return [msg for value in detail.values() for msg in _flatten(value)]
    if isinstance(detail, list):
        return [msg for item in detail for msg in _flatten(item)]
    return [str(detail)]


def _validation_response(exc: drf.ValidationError) -> Response:
    """Map a DRF ValidationError to a 400 envelope with per-field messages."""
    detail = exc.detail
    message = ValidationFailed.message
    fields: dict[str, list[str]] = {}
    if isinstance(detail, dict):
        for key, value in detail.items():
            if key in ("non_field_errors", "detail"):
                message = " ".join(_flatten(value))
            else:
                fields[key] = _flatten(value)
    else:
        message = " ".join(_flatten(detail))
    return Response(error_body(400, "validation_error", message, fields), status=400)


def api_exception_handler(exc, context) -> Response:
    """DRF exception handler: every API error leaves through the envelope."""
    if isinstance(exc, AppError):
        body = error_body(exc.status, exc.code, exc.message, exc.fields, exc.details)
        return Response(body, status=exc.status)
    if isinstance(exc, drf.ValidationError):
        return _validation_response(exc)
    if isinstance(exc, drf.NotAuthenticated | drf.AuthenticationFailed):
        return Response(
            error_body(401, "not_authenticated", "Please log in to continue."), status=401
        )
    if isinstance(exc, drf.PermissionDenied | DjangoPermissionDenied):
        text = str(getattr(exc, "detail", exc))
        if text.startswith("CSRF Failed"):
            return Response(
                error_body(403, "csrf_failed", "Your session token expired. Please retry."),
                status=403,
            )
        return Response(error_body(403, "permission_denied", Forbidden.message), status=403)
    if isinstance(exc, Http404 | drf.NotFound):
        return Response(error_body(404, "not_found", NotFound.message), status=404)
    if isinstance(exc, drf.Throttled):
        wait = int(exc.wait) if exc.wait is not None else None
        body = error_body(
            429, "throttled", "Too many requests. Please slow down.", details={"retry_after": wait}
        )
        response = Response(body, status=429)
        if wait is not None:
            response["Retry-After"] = str(wait)
        return response
    if isinstance(exc, drf.UnsupportedMediaType):
        return Response(error_body(415, "unsupported_media_type", str(exc.detail)), status=415)
    if isinstance(exc, drf.ParseError):
        return Response(error_body(400, "validation_error", str(exc.detail)), status=400)
    if isinstance(exc, drf.APIException):
        return Response(
            error_body(exc.status_code, exc.default_code, str(exc.detail)), status=exc.status_code
        )
    logger.exception("unhandled_error")
    return Response(
        error_body(500, "server_error", "Something went wrong on our side."), status=500
    )


class ErrorDetailSerializer(serializers.Serializer):
    """The body of the error envelope (for the OpenAPI schema)."""

    code = serializers.CharField()
    message = serializers.CharField()
    fields = serializers.DictField(child=serializers.ListField(child=serializers.CharField()))
    details = serializers.DictField()
    request_id = serializers.CharField()


class ErrorSerializer(serializers.Serializer):
    """The error envelope every non-2xx API response uses."""

    error = ErrorDetailSerializer()


@extend_schema(exclude=True)
@api_view(["GET", "POST", "PUT", "PATCH", "DELETE"])
@authentication_classes([])
@permission_classes([AllowAny])
def api_not_found(request, *args, **kwargs):
    """Catch-all for unknown /api paths so they return the envelope even in DEBUG."""
    raise NotFound()


def json_404(request, exception=None):
    """Django handler404: the envelope for /api paths, the default page elsewhere."""
    if request.path.startswith("/api/"):
        return JsonResponse(error_body(404, "not_found", NotFound.message), status=404)
    return defaults.page_not_found(request, exception)


def json_500(request):
    """Django handler500: the envelope for /api paths, the default page elsewhere."""
    if request.path.startswith("/api/"):
        body = error_body(500, "server_error", "Something went wrong on our side.")
        return JsonResponse(body, status=500)
    return defaults.server_error(request)
