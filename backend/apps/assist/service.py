"""AI Review Assist: cache, timeout, one retry, fallback and an injection policy.

This module is advisory only. It reads documents and never changes their status.
"""

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from django.conf import settings
from pydantic import ValidationError

from apps.accounts.models import User
from apps.assist.extract import UnsupportedContent, extract_text
from apps.assist.models import AssistResult
from apps.assist.prompt import PROMPT_VERSION, SYSTEM_PROMPT, build_prompt, detect_injection
from apps.assist.providers import (
    ProviderError,
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
    "timeout": "AI Assist took too long to answer. Try again in a moment.",
    "provider_error": "AI Assist is unavailable right now. You can still review the document.",
    "invalid_output": "AI Assist gave an answer we couldn't use. Try again, or review without it.",
}


@dataclass
class AssistOutcome:
    """What the assist endpoint returns: a report, or a calm reason why there isn't one."""

    status: Literal["ok", "unavailable"]
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
        update={"risk_flags": [flag, *report.risk_flags][:6], "suggested_decision": decision}
    )


def _generate(providers: list, text: str, truncated: bool) -> tuple:
    """Try each attempt's provider in turn; return (report, provider, "", "") or failure info."""
    reason = error = ""
    for provider in providers:
        try:
            raw = provider.generate(
                SYSTEM_PROMPT, build_prompt(text, truncated), settings.AI_TIMEOUT_SECONDS
            )
            return AssistReport.model_validate_json(raw), provider, "", ""
        except ProviderTimeout as exc:
            reason, error = "timeout", str(exc)
        except ProviderError as exc:
            reason, error = "provider_error", str(exc)
        except ValidationError as exc:
            reason, error = "invalid_output", f"{exc.error_count()} validation error(s)"
    return None, None, reason, error


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

    # The retry goes to the fallback model when one is configured (e.g. the newest model is busy).
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
            return AssistOutcome(
                status="ok",
                report=cached.report,
                provider=cached.provider,
                model=cached.model,
                cached=True,
                generated_at=cached.created_at,
            )

    report, used, reason, error = _generate(attempts, text, truncated)
    if report is None:
        return _unavailable(reason, doc_id, error[:300])
    report = apply_policy(report, detect_injection(text))
    result, _ = AssistResult.objects.update_or_create(
        **key, model=used.model, defaults={"report": report.model_dump()}
    )
    logger.info(
        "assist.generated",
        extra={"document_id": doc_id, "provider": used.name, "model": used.model},
    )
    return AssistOutcome(
        status="ok",
        report=result.report,
        provider=result.provider,
        model=result.model,
        cached=False,
        generated_at=result.created_at,
    )
