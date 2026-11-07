import copy
import json

import pytest

VALID = {
    "summary": "A vendor contract for logistics services.",
    "key_points": ["12-month term", "Net 30 payment"],
    "missing_items": ["Signed data processing addendum"],
    "risk_flags": [{"label": "Auto-renewal", "severity": "medium", "evidence": "auto-renewing"}],
    "suggested_decision": "needs_more_info",
    "rationale": "The addendum is referenced but not attached.",
    "suggested_rejection_note": "Please attach the signed data processing addendum.",
}


@pytest.fixture
def valid_report() -> dict:
    """A fresh copy of a schema-valid report."""
    return copy.deepcopy(VALID)


@pytest.fixture
def fake(monkeypatch):
    """Install a scripted FakeProvider for the assist service and return it."""
    from apps.assist import service
    from apps.assist.providers import FakeProvider

    def _install(script=None):
        """Script the provider's responses (strings or exceptions), in order."""
        provider = FakeProvider([json.dumps(s) if isinstance(s, dict) else s for s in script or []])
        monkeypatch.setattr(service, "get_provider", lambda: provider)
        return provider

    return _install
