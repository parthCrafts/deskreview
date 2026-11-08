"""Authentication use cases."""

from django.conf import settings
from django.contrib.auth import authenticate, login
from django.db.models import Count, Q, QuerySet

from apps.accounts.models import Role, User
from common.errors import Forbidden, InvalidCredentials, NotFound

_MODEL_BACKEND = "django.contrib.auth.backends.ModelBackend"


def authenticate_user(request, username: str, password: str) -> User:
    """Check credentials and start a session, or raise InvalidCredentials."""
    user = authenticate(request, username=username, password=password)
    if user is None:
        raise InvalidCredentials()
    login(request, user)
    return user


def list_demo_users() -> QuerySet[User]:
    """Return demo users for the one-click login buttons, or raise NotFound if disabled."""
    if not settings.DEMO_LOGIN_ENABLED:
        raise NotFound()
    return User.objects.filter(is_demo=True, is_active=True).order_by("role", "username")


def demo_login(request, username: str) -> User:
    """Start a session for a demo user without a password, or raise NotFound."""
    user = list_demo_users().filter(username=username).first()
    if user is None:
        raise NotFound()
    login(request, user, backend=_MODEL_BACKEND)
    return user


def list_users_with_activity(actor: User) -> list[User]:
    """Every user with submission and review counts, for admins only."""
    if not actor.is_admin:
        raise Forbidden()
    role_order = {Role.ADMIN: 0, Role.REVIEWER: 1, Role.SUBMITTER: 2}
    submitted = {
        "submitted_total": Count("documents", distinct=True),
        **{
            f"submitted_{status}": Count(
                "documents", filter=Q(documents__status=status), distinct=True
            )
            for status in ("pending", "approved", "rejected")
        },
    }
    reviewed = {
        f"reviewed_{status}": Count("decisions", filter=Q(decisions__status=status), distinct=True)
        for status in ("approved", "rejected")
    }
    users = User.objects.annotate(**submitted, **reviewed)
    return sorted(users, key=lambda u: (role_order.get(u.role, 9), u.display_name or u.username))
