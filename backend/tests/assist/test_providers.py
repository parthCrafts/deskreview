import pytest

from apps.assist import providers
from apps.assist.providers import (
    FakeProvider,
    GeminiProvider,
    ProviderError,
    ProviderTimeout,
    get_provider,
)


def test_get_provider_selection(settings):
    """AI_PROVIDER picks the provider; Gemini needs a key."""
    settings.AI_PROVIDER = "none"
    assert get_provider() is None
    settings.AI_PROVIDER = "fake"
    assert isinstance(get_provider(), FakeProvider)
    settings.AI_PROVIDER, settings.GEMINI_API_KEY = "gemini", ""
    assert get_provider() is None
    settings.GEMINI_API_KEY, settings.GEMINI_MODEL = "k", "gemini-x"
    provider = get_provider()
    assert isinstance(provider, GeminiProvider) and provider.model == "gemini-x"


def test_fake_default_report_is_valid():
    """The unscripted fake returns a schema-valid report."""
    from apps.assist.schema import AssistReport

    AssistReport.model_validate_json(FakeProvider().generate("s", "p", 1))


class _Models:
    """Stand-in for client.models that raises or returns a canned response."""

    def __init__(self, outcome):
        """Remember what generate_content should do."""
        self.outcome, self.kwargs = outcome, None

    def generate_content(self, **kwargs):
        """Raise or return the configured outcome."""
        self.kwargs = kwargs
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return type("R", (), {"text": self.outcome})()


class ReadTimeout(Exception):
    """Mimics an HTTP client's read-timeout exception."""


@pytest.mark.parametrize(
    "error,expected",
    [
        (ReadTimeout("slow"), ProviderTimeout),
        (TimeoutError("slow"), ProviderTimeout),
        (RuntimeError("504 DEADLINE_EXCEEDED. Deadline expired"), ProviderTimeout),
        (RuntimeError("boom"), ProviderError),
    ],
)
def test_gemini_maps_errors(monkeypatch, error, expected):
    """SDK timeouts and failures become provider exceptions."""
    models = _Models(error)
    monkeypatch.setattr(
        providers, "_gemini_client", lambda key: type("C", (), {"models": models})()
    )
    with pytest.raises(expected):
        GeminiProvider("k", "m").generate("sys", "prompt", 12)


def test_gemini_sends_schema_and_settings(monkeypatch):
    """The request uses JSON mode, the schema, temperature 0.2 and the timeout in ms."""
    models = _Models('{"ok": true}')
    monkeypatch.setattr(
        providers, "_gemini_client", lambda key: type("C", (), {"models": models})()
    )
    assert GeminiProvider("k", "gemini-x").generate("sys", "prompt", 12) == '{"ok": true}'
    config = models.kwargs["config"]
    assert models.kwargs["model"] == "gemini-x" and models.kwargs["contents"] == "prompt"
    assert config.response_mime_type == "application/json" and config.temperature == 0.2
    assert config.system_instruction == "sys" and config.http_options.timeout == 12_000
    assert config.thinking_config.thinking_level == "LOW"
    assert config.max_output_tokens == providers.MAX_OUTPUT_TOKENS


def test_models_and_thinking_levels(settings):
    """The primary is the capable model at low thinking; the fallback is fast at minimal."""
    from apps.assist.providers import get_fallback_provider

    settings.AI_PROVIDER, settings.GEMINI_API_KEY = "gemini", "k"
    settings.GEMINI_MODEL, settings.GEMINI_THINKING_LEVEL = "gemini-3.8-flash", "low"
    settings.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite"
    settings.GEMINI_FALLBACK_THINKING_LEVEL = "minimal"
    assert (get_provider().model, get_provider().thinking_level) == ("gemini-3.8-flash", "low")
    fallback = get_fallback_provider()
    assert (fallback.model, fallback.thinking_level) == ("gemini-3.5-flash-lite", "minimal")


def test_fallback_provider_selection(settings):
    """A Gemini fallback model is offered only when configured and different."""
    from apps.assist.providers import get_fallback_provider

    settings.AI_PROVIDER, settings.GEMINI_API_KEY = "gemini", "k"
    settings.GEMINI_MODEL, settings.GEMINI_FALLBACK_MODEL = "a", "b"
    assert get_fallback_provider().model == "b"
    settings.GEMINI_FALLBACK_MODEL = "a"
    assert get_fallback_provider() is None
    settings.GEMINI_FALLBACK_MODEL = ""
    assert get_fallback_provider() is None
    settings.AI_PROVIDER = "fake"
    assert get_fallback_provider() is None
