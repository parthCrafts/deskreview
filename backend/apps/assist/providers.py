"""AI providers behind one small interface: Gemini for real use, a scripted fake for tests."""

import json
from typing import Protocol

from django.conf import settings

# Covers thinking plus the short JSON brief; a cut-off answer fails validation and falls back.
MAX_OUTPUT_TOKENS = 2048


class ProviderTimeout(Exception):
    """The provider did not answer in time."""


class ProviderError(Exception):
    """The provider failed (quota, 5xx, bad key, network)."""


class AssistProvider(Protocol):
    """Anything that turns a system prompt and a user prompt into raw JSON text."""

    name: str
    model: str

    def generate(self, system: str, prompt: str, timeout: float) -> str:
        """Return the model's raw JSON answer."""
        ...


def _gemini_client(api_key: str):
    """Create a google-genai client (imported lazily: the SDK is slow to import)."""
    from google import genai

    return genai.Client(api_key=api_key)


def _is_timeout(exc: BaseException) -> bool:
    """Whether an exception (or its cause) is a timeout, whichever HTTP library raised it."""
    while exc is not None:
        if isinstance(exc, TimeoutError) or "timeout" in type(exc).__name__.lower():
            return True
        if "DEADLINE_EXCEEDED" in str(exc):
            return True
        exc = exc.__cause__ or exc.__context__
    return False


class GeminiProvider:
    """Google Gemini via AI Studio, in JSON mode with a response schema."""

    name = "gemini"

    def __init__(self, api_key: str, model: str, thinking_level: str = "low"):
        """Remember the key, model name and how much the model may think before answering."""
        self.api_key = api_key
        self.model = model
        self.thinking_level = thinking_level

    def generate(self, system: str, prompt: str, timeout: float) -> str:
        """Call generate_content once; map timeouts and failures to provider exceptions."""
        from google.genai import types

        from apps.assist.schema import GEMINI_RESPONSE_SCHEMA

        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=GEMINI_RESPONSE_SCHEMA,
            temperature=0.2,
            # The brief is short by design: a tight token cap and little thinking keep it fast.
            max_output_tokens=MAX_OUTPUT_TOKENS,
            thinking_config=types.ThinkingConfig(thinking_level=self.thinking_level),
            http_options=types.HttpOptions(timeout=int(timeout * 1000)),
        )
        client = _gemini_client(
            self.api_key
        )  # keep a reference: the SDK closes on garbage collection
        try:
            response = client.models.generate_content(
                model=self.model, contents=prompt, config=config
            )
        except Exception as exc:
            if _is_timeout(exc):
                raise ProviderTimeout(str(exc)) from exc
            raise ProviderError(f"{type(exc).__name__}: {exc}") from exc
        if not response.text:
            raise ProviderError("empty response")
        return response.text


_FAKE_REPORT = {
    "summary": "🧪 Sample brief from the fake AI provider, so the demo works without an API key.",
    "key_points": [
        "🧪 Generated locally: no real model read this document",
        "⚡ Returns instantly, so loading and layout are easy to check",
        "🔑 Set GEMINI_API_KEY to get real briefs",
    ],
    "missing_items": [],
    "risk_flags": [],
    "suggested_decision": "needs_more_info",
    "rationale": "The fake provider does not read the document, so it can't judge it.",
    "suggested_rejection_note": None,
    "suggested_approval_note": None,
}


class FakeProvider:
    """Deterministic provider; a script of strings or exceptions is consumed one per call."""

    name = "fake"
    model = "fake-1"

    def __init__(self, script: list[str | Exception] | None = None):
        """Queue scripted answers; without a script every call returns a fixed valid report."""
        self.script = list(script or [])
        self.calls = 0

    def generate(self, system: str, prompt: str, timeout: float) -> str:
        """Return or raise the next scripted item."""
        self.calls += 1
        if not self.script:
            return json.dumps(_FAKE_REPORT)
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def get_provider() -> AssistProvider | None:
    """Return the configured provider, or None when AI Assist is off."""
    choice = settings.AI_PROVIDER
    if choice == "fake":
        return FakeProvider()
    if choice == "gemini" and settings.GEMINI_API_KEY:
        return GeminiProvider(
            settings.GEMINI_API_KEY, settings.GEMINI_MODEL, settings.GEMINI_THINKING_LEVEL
        )
    return None


def get_fallback_provider() -> AssistProvider | None:
    """Return the fast Gemini model raced against (or retried after) the primary, if any."""
    primary = get_provider()
    fallback = settings.GEMINI_FALLBACK_MODEL
    if not isinstance(primary, GeminiProvider) or not fallback or fallback == primary.model:
        return None
    return GeminiProvider(
        settings.GEMINI_API_KEY, fallback, settings.GEMINI_FALLBACK_THINKING_LEVEL
    )
