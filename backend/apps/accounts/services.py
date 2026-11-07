"""Authentication use cases."""

from django.conf import settings
from django.contrib.auth import authenticate, login
from django.db.models import QuerySet

from apps.accounts.models import User
from common.errors import InvalidCredentials, NotFound

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
