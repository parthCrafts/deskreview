"""Review state machine. Pure Python: the only place transition rules live."""

from enum import StrEnum


class Status(StrEnum):
    """Document status."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Decision(StrEnum):
    """A reviewer's decision."""

    APPROVE = "approve"
    REJECT = "reject"


TRANSITIONS: dict[tuple[Status, Decision], Status] = {
    (Status.PENDING, Decision.APPROVE): Status.APPROVED,
    (Status.PENDING, Decision.REJECT): Status.REJECTED,
}
TERMINAL: frozenset[Status] = frozenset({Status.APPROVED, Status.REJECTED})
MAX_COMMENT_LENGTH = 2000


class CommentRequired(Exception):
    """Raised when a rejection has no comment."""


class InvalidTransition(Exception):
    """Raised when the document's current status does not allow the decision."""

    def __init__(self, current: Status):
        """Remember the status the document is already in."""
        super().__init__(f"Document is already {current}.")
        self.current = Status(current)


def decide(current: Status, decision: Decision, comment: str | None) -> Status:
    """Return the status a decision leads to, or raise if the rules forbid it."""
    new_status = TRANSITIONS.get((Status(current), Decision(decision)))
    if new_status is None:
        raise InvalidTransition(current)
    if decision == Decision.REJECT and not (comment or "").strip():
        raise CommentRequired()
    return new_status


def event_type_for(decision: Decision) -> str:
    """Return the event type recorded for a decision."""
    return {Decision.APPROVE: "approved", Decision.REJECT: "rejected"}[Decision(decision)]
