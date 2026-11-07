"""Thin assist view: call the service, return its outcome with the advisory notice."""

from dataclasses import asdict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assist.service import get_or_generate_assist
from common.errors import ErrorSerializer
from common.throttles import AssistThrottle

NOTICE = "Advisory only. You make the decision."


class AssistResponseSerializer(serializers.Serializer):
    """An AI report, or the reason none is available (both are HTTP 200)."""

    status = serializers.ChoiceField(choices=["ok", "unavailable"])
    reason = serializers.CharField(allow_null=True)
    message = serializers.CharField(allow_null=True)
    report = serializers.DictField(allow_null=True)
    provider = serializers.CharField(allow_null=True)
    model = serializers.CharField(allow_null=True)
    cached = serializers.BooleanField()
    generated_at = serializers.DateTimeField(allow_null=True)
    notice = serializers.CharField()


class DocumentAssistView(APIView):
    """AI Review Assist for one document (reviewers only, throttled)."""

    throttle_classes = [AssistThrottle]

    @extend_schema(
        operation_id="documents_assist",
        request=None,
        parameters=[OpenApiParameter("refresh", bool, description="Ignore the cached report.")],
        responses={
            200: AssistResponseSerializer,
            **{code: ErrorSerializer for code in (403, 404, 429)},
        },
    )
    def post(self, request, document_id: str):
        """Generate (or return the cached) advisory report."""
        refresh = request.query_params.get("refresh", "").lower() in {"1", "true", "yes"}
        outcome = get_or_generate_assist(request.user, document_id, refresh=refresh)
        return Response(AssistResponseSerializer({**asdict(outcome), "notice": NOTICE}).data)
