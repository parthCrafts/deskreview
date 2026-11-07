"""Throwaway routes that raise each error type, for envelope tests."""

from django.urls import include, path
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

import config.urls
from common.errors import Conflict


class _TitleSerializer(serializers.Serializer):
    """Requires a title."""

    title = serializers.CharField(error_messages={"required": "Title is required."})


@api_view(["GET"])
@permission_classes([AllowAny])
def raise_validation(request):
    """Fail serializer validation."""
    _TitleSerializer(data={}).is_valid(raise_exception=True)
    return Response({})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def protected(request):
    """Require authentication."""
    return Response({})


@api_view(["GET"])
@permission_classes([AllowAny])
def raise_conflict(request):
    """Raise a 409 with details."""
    raise Conflict("Already approved.", details={"status": "approved"})


@api_view(["GET"])
@permission_classes([AllowAny])
def boom(request):
    """Raise an unexpected error."""
    raise RuntimeError("kaboom")


urlpatterns = [
    path("raise/validation", raise_validation),
    path("raise/protected", protected),
    path("raise/conflict", raise_conflict),
    path("raise/boom", boom),
    path("", include(config.urls.urlpatterns)),
]
