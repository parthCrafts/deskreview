import pytest

from apps.documents.domain import (
    TERMINAL,
    CommentRequired,
    Decision,
    InvalidTransition,
    Status,
    decide,
    event_type_for,
)


@pytest.mark.parametrize(
    "decision,expected",
    [(Decision.APPROVE, Status.APPROVED), (Decision.REJECT, Status.REJECTED)],
)
def test_pending_transitions(decision, expected):
    """Pending documents can be approved or rejected."""
    assert decide(Status.PENDING, decision, "ok") == expected


def test_approve_comment_optional():
    """Approving needs no comment."""
    assert decide(Status.PENDING, Decision.APPROVE, None) == Status.APPROVED


@pytest.mark.parametrize("comment", [None, "", "   \n"])
def test_reject_requires_comment(comment):
    """Rejecting with a blank comment is refused."""
    with pytest.raises(CommentRequired):
        decide(Status.PENDING, Decision.REJECT, comment)


@pytest.mark.parametrize("current", [Status.APPROVED, Status.REJECTED])
@pytest.mark.parametrize("decision", list(Decision))
def test_terminal_states_reject_any_decision(current, decision):
    """Decided documents cannot be decided again."""
    with pytest.raises(InvalidTransition) as e:
        decide(current, decision, "x")
    assert e.value.current == current


def test_terminal_checked_before_comment():
    """A conflict wins over a missing comment once the request shape is valid."""
    with pytest.raises(InvalidTransition):
        decide(Status.APPROVED, Decision.REJECT, "")


def test_terminal_set():
    """Both outcomes are terminal."""
    assert TERMINAL == {Status.APPROVED, Status.REJECTED}


def test_event_type_for():
    """Each decision maps to its event type."""
    assert event_type_for(Decision.APPROVE) == "approved"
    assert event_type_for(Decision.REJECT) == "rejected"
