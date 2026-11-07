"""Page-number pagination that never errors past the last page."""

from django.db.models import QuerySet


def paginate(qs: QuerySet, page: int, page_size: int) -> dict:
    """Slice a queryset into a page and describe its neighbours by page number."""
    count = qs.count()
    start = (page - 1) * page_size
    return {
        "count": count,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if start + page_size < count else None,
        "previous": page - 1 if page > 1 else None,
        "results_qs": qs[start : start + page_size],
    }
