"""Thin document views: parse, call one service, serialize."""

from django.http import FileResponse
from django.utils.decorators import method_decorator
from django.views.decorators.clickjacking import xframe_options_sameorigin
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents import services
from apps.documents.api.pagination import paginate
from apps.documents.api.serializers import (
    DocumentCreateSerializer,
    DocumentDetailSerializer,
    DocumentPageSerializer,
    DocumentSummarySerializer,
    FileQuerySerializer,
    ListQuerySerializer,
    ReviewSerializer,
)
from apps.documents.domain import Decision
from common.errors import ErrorSerializer
from common.throttles import UploadThrottle


def detail_response(request, document, status: int = 200) -> Response:
    """Serialize a document with its timeline for the requesting user."""
    data = DocumentDetailSerializer(document, context={"actor": request.user}).data
    return Response(data, status=status)


class DocumentListCreateView(APIView):
    """List documents or submit a new one."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_throttles(self):
        """Throttle submissions only."""
        return [UploadThrottle()] if self.request.method == "POST" else []

    @extend_schema(
        operation_id="documents_list",
        parameters=[ListQuerySerializer],
        responses={200: DocumentPageSerializer, 400: ErrorSerializer},
    )
    def get(self, request):
        """List visible documents with filters, search, counts and paging."""
        query = ListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        documents, counts = services.list_documents(
            request.user, scope=params.get("scope"), status=params.get("status"), q=params["q"]
        )
        page = paginate(documents, params["page"], params["page_size"])
        results = DocumentSummarySerializer(page.pop("results_qs"), many=True).data
        return Response({**page, "counts": counts, "results": results})

    @extend_schema(
        operation_id="documents_create",
        request={
            "multipart/form-data": DocumentCreateSerializer,
            "application/json": DocumentCreateSerializer,
        },
        responses={
            201: DocumentDetailSerializer,
            **{code: ErrorSerializer for code in (400, 413, 415, 429)},
        },
    )
    def post(self, request):
        """Submit a document as text or a file."""
        data = DocumentCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        document = services.submit_document(
            request.user,
            title=values.get("title"),
            text=values.get("text"),
            file=values.get("file"),
        )
        return detail_response(request, document, status=201)


class DocumentDetailView(APIView):
    """A single document. Read-only: status changes only through the review action."""

    @extend_schema(
        operation_id="documents_retrieve",
        responses={200: DocumentDetailSerializer, 404: ErrorSerializer},
    )
    def get(self, request, document_id: str):
        """Return a document with its timeline."""
        return detail_response(request, services.get_document(request.user, document_id))


class DocumentReviewView(APIView):
    """The review action: the only way a document's status changes."""

    @extend_schema(
        operation_id="documents_review",
        request=ReviewSerializer,
        responses={
            200: DocumentDetailSerializer,
            **{code: ErrorSerializer for code in (400, 403, 404, 409)},
        },
    )
    def post(self, request, document_id: str):
        """Approve or reject a pending document."""
        data = ReviewSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        document = services.review_document(
            request.user,
            document_id,
            decision=Decision(data.validated_data["decision"]),
            comment=data.validated_data.get("comment"),
        )
        return detail_response(request, document)


@method_decorator(xframe_options_sameorigin, name="dispatch")
class DocumentFileView(APIView):
    """Authenticated download of a document's file."""

    @extend_schema(
        operation_id="documents_file",
        parameters=[FileQuerySerializer],
        responses={(200, "application/octet-stream"): OpenApiResponse(description="File bytes")},
    )
    def get(self, request, document_id: str):
        """Stream the file with safe headers."""
        query = FileQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        file, document = services.open_document_file(request.user, document_id)
        response = FileResponse(
            file,
            content_type=document.content_type,
            as_attachment=query.validated_data["disposition"] == "attachment",
            filename=document.original_filename,
        )
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        return response
