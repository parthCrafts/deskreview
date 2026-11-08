"""AI Review Assist: cache, timeouts, a hedged fallback model and an injection policy.

This module is advisory only. It reads documents and never changes their status.
"""

import hashlib
import logging
import time
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from django.conf import settings
from django.db import transaction
from pydantic import ValidationError

from apps.accounts.models import User
from apps.assist.extract import UnsupportedContent, extract_text
from apps.assist.models import AssistResult
from apps.assist.prompt import PROMPT_VERSION, SYSTEM_PROMPT, build_prompt, detect_injection
from apps.assist.providers import (
    ProviderTimeout,
    get_fallback_provider,
    get_provider,
)
from apps.assist.schema import AssistReport, RiskFlag
from apps.documents.services import get_document
from common.errors import Forbidden

logger = logging.getLogger("deskreview.assist")

MAX_ATTEMPTS = 2
INJECTION_FLAG = "Document contains instructions aimed at the AI reviewer"
FALLBACK_MESSAGES = {
    "not_configured": "AI Assist is off: no API key configured.",
    "unsupported_content": "AI Assist reads text and PDFs. This file has no readable text.",
    "timeout": "AI Assist took too long to answer, even with the backup model. Try again.",
    "provider_error": "AI Assist is unavailable right now. You can still review the document.",
    "invalid_output": "AI Assist gave an answer we couldn't use. Try again, or review without it.",
}


@dataclass
class AssistOutcome:
    """What the assist endpoint returns: a report, or a calm reason why there isn't one."""

    status: Literal["ok", "unavailable", "empty"]
    reason: str | None = None
    message: str | None = None
    report: dict | None = None
    provider: str | None = None
    model: str | None = None
    cached: bool = False
    generated_at: datetime | None = None


def _unavailable(reason: str, document_id: str, error: str | None = None) -> AssistOutcome:
    """Build a fallback outcome and log it (with the underlying error for operators)."""
    logger.warning(
        "assist.fallback", extra={"document_id": document_id, "reason": reason, "error": error}
    )
    return AssistOutcome(status="unavailable", reason=reason, message=FALLBACK_MESSAGES[reason])


def apply_policy(report: AssistReport, injection: bool) -> AssistReport:
    """Flag injection attempts and never let a flagged document get an approve suggestion."""
    if not injection:
        if report.suggested_decision != "approve" and report.suggested_approval_note:
            return report.model_copy(update={"suggested_approval_note": None})
        return report
    flag = RiskFlag(
        label=INJECTION_FLAG,
        severity="high",
        evidence="The text includes phrases that try to instruct an AI reviewer.",
    )
    decision = (
        "needs_more_info" if report.suggested_decision == "approve" else report.suggested_decision
    )
    return report.model_copy(
        update={
            "risk_flags": [flag, *report.risk_flags][:6],
            "suggested_decision": decision,
            "suggested_approval_note": None,
        }
    )


def _attempt(provider, text: str, truncated: bool) -> AssistReport:
    """One model call, validated against the report contract."""
    raw = provider.generate(
        SYSTEM_PROMPT, build_prompt(text, truncated), settings.AI_TIMEOUT_SECONDS
    )
    return AssistReport.model_validate_json(raw)


def _failure(exc: BaseException) -> tuple[str, str]:
    """Map an attempt's exception to (reason, operator-facing error)."""
    if isinstance(exc, ProviderTimeout):
        return "timeout", str(exc)
    if isinstance(exc, ValidationError):
        return "invalid_output", f"{exc.error_count()} validation error(s)"
    return "provider_error", f"{type(exc).__name__}: {exc}"


def _generate(providers: list, text: str, truncated: bool) -> tuple:
    """Race the attempts: return (report, provider, "", "") or (None, None, reason, error).

    The first attempt starts at once. The next one starts as soon as the previous fails, or
    in parallel after AI_HEDGE_SECONDS if it is still running, and the first valid report wins.
    Every call has its own timeout, and the whole race is capped so a stuck call can't hang.
    """
    queue = list(providers)
    hedge = settings.AI_HEDGE_SECONDS
    deadline = time.monotonic() + settings.AI_TIMEOUT_SECONDS + hedge * len(queue) + 1
    reason, error = "timeout", "no attempt finished in time"
    running: dict[Future, object] = {}
    pool = ThreadPoolExecutor(max_workers=len(queue), thread_name_prefix="assist")

    def start_next() -> None:
        provider = queue.pop(0)
        running[pool.submit(_attempt, provider, text, truncated)] = provider

    try:
        start_next()
        while running:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            done, _ = wait(
                running,
                timeout=min(hedge, remaining) if queue else remaining,
                return_when=FIRST_COMPLETED,
            )
            if not done:  # still waiting: hedge with the next attempt, if there is one
                if queue:
                    start_next()
                continue
            for future in done:
                provider = running.pop(future)
                try:
                    return future.result(), provider, "", ""
                except Exception as exc:  # noqa: BLE001 - every failure means "try the next"
                    reason, error = _failure(exc)
                    logger.info(
                        "assist.attempt_failed",
                        extra={"model": provider.model, "reason": reason},
                    )
            if queue and not running:
                start_next()
    finally:
        # Don't wait for a losing call: it ends on its own timeout and its answer is dropped.
        pool.shutdown(wait=False, cancel_futures=True)
    return None, None, reason, error


def _saved(result: AssistResult) -> AssistOutcome:
    """A stored report as an outcome."""
    return AssistOutcome(
        status="ok",
        report=result.report,
        provider=result.provider,
        model=result.model,
        cached=True,
        generated_at=result.created_at,
    )


def get_saved_assist(actor: User, document_id: str) -> AssistOutcome:
    """Return the document's saved brief without calling a model (reviewers and admins)."""
    if not (actor.is_reviewer or actor.is_admin):
        raise Forbidden()
    document = get_document(actor, document_id)
    latest = AssistResult.objects.filter(document=document).order_by("-created_at").first()
    return _saved(latest) if latest else AssistOutcome(status="empty")


def get_or_generate_assist(
    actor: User, document_id: str, *, refresh: bool = False
) -> AssistOutcome:
    """Return an advisory report for a reviewer, from cache when the content is unchanged."""
    if not actor.is_reviewer:
        raise Forbidden()
    document = get_document(actor, document_id)
    doc_id = str(document.id)
    provider = get_provider()
    if provider is None:
        return _unavailable("not_configured", doc_id)
    try:
        text, truncated = extract_text(document)
    except UnsupportedContent:
        return _unavailable("unsupported_content", doc_id)

    # The fallback model (when configured) races a slow primary and takes over a failed one.
    attempts = [provider, get_fallback_provider() or provider][:MAX_ATTEMPTS]
    key = {
        "document": document,
        "content_sha256": hashlib.sha256(text.encode()).hexdigest(),
        "prompt_version": PROMPT_VERSION,
        "provider": provider.name,
    }
    if not refresh:
        models = {p.model for p in attempts}
        cached = (
            AssistResult.objects.filter(**key, model__in=models).order_by("-created_at").first()
        )
        if cached:
            return _saved(cached)

    started = time.monotonic()
    report, used, reason, error = _generate(attempts, text, truncated)
    if report is None:
        return _unavailable(reason, doc_id, error[:300])
    report = apply_policy(report, detect_injection(text))
    with transaction.atomic():  # one saved brief per document: the newest replaces the rest
        result, _ = AssistResult.objects.update_or_create(
            **key, model=used.model, defaults={"report": report.model_dump()}
        )
        AssistResult.objects.filter(document=document).exclude(pk=result.pk).delete()
    logger.info(
        "assist.generated",
        extra={
            "document_id": doc_id,
            "provider": used.name,
            "model": used.model,
            "elapsed_ms": round((time.monotonic() - started) * 1000),
        },
    )
    return AssistOutcome(
        status="ok",
        report=result.report,
        provider=result.provider,
        model=result.model,
        cached=False,
        generated_at=result.created_at,
    )
