"""The AI report contract, validated locally; nothing outside it reaches the UI."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RiskFlag(BaseModel):
    """One concern the reviewer should look at."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(max_length=120)
    severity: Literal["low", "medium", "high"]
    evidence: str = Field(max_length=300)


class AssistReport(BaseModel):
    """Advisory review notes for one document."""

    model_config = ConfigDict(extra="forbid")

    summary: str = Field(max_length=600)
    key_points: list[str] = Field(max_length=6)
    missing_items: list[str] = Field(max_length=6)
    risk_flags: list[RiskFlag] = Field(max_length=6)
    suggested_decision: Literal["approve", "reject", "needs_more_info"]
    rationale: str = Field(max_length=600)
    suggested_rejection_note: str | None = Field(default=None, max_length=1000)
    suggested_approval_note: str | None = Field(default=None, max_length=600)


def _string_list(max_items: int) -> dict:
    """Schema for a short list of strings."""
    return {"type": "ARRAY", "items": {"type": "STRING"}, "max_items": max_items}


# Gemini's response_schema is an OpenAPI subset without additionalProperties, so the
# strict extra="forbid" check happens locally with AssistReport.
GEMINI_RESPONSE_SCHEMA: dict = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING", "max_length": 600},
        "key_points": _string_list(6),
        "missing_items": _string_list(6),
        "risk_flags": {
            "type": "ARRAY",
            "max_items": 6,
            "items": {
                "type": "OBJECT",
                "properties": {
                    "label": {"type": "STRING", "max_length": 120},
                    "severity": {"type": "STRING", "enum": ["low", "medium", "high"]},
                    "evidence": {"type": "STRING", "max_length": 300},
                },
                "required": ["label", "severity", "evidence"],
            },
        },
        "suggested_decision": {"type": "STRING", "enum": ["approve", "reject", "needs_more_info"]},
        "rationale": {"type": "STRING", "max_length": 600},
        "suggested_rejection_note": {"type": "STRING", "nullable": True, "max_length": 1000},
        "suggested_approval_note": {"type": "STRING", "nullable": True, "max_length": 600},
    },
    "required": list(AssistReport.model_fields),
    "property_ordering": list(AssistReport.model_fields),
}
