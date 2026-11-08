"""Thin auth views: parse, call a service, serialize."""

from django.contrib.auth import logout as django_logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import services
from apps.accounts.serializers import (
    AdminUserSerializer,
    DemoLoginSerializer,
    DemoUserSerializer,
    LoginSerializer,
    UserSerializer,
)
from common.errors import ErrorSerializer
from common.throttles import LoginThrottle


def _enforce_csrf(request) -> None:
    """Run the CSRF check on an anonymous endpoint (DRF skips it when nobody is logged in)."""
    SessionAuthentication().enforce_csrf(request)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    """The current user; also hands the SPA its CSRF cookie."""

    @extend_schema(responses={200: UserSerializer, 401: ErrorSerializer})
    def get(self, request):
        """Return the logged-in user."""
        return Response(UserSerializer(request.user).data)


class LoginView(APIView):
    """Password login."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    @extend_schema(
        request=LoginSerializer,
        responses={200: UserSerializer, 400: ErrorSerializer, 429: ErrorSerializer},
    )
    def post(self, request):
        """Log in with username and password."""
        _enforce_csrf(request)
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = services.authenticate_user(request, **data.validated_data)
        return Response(UserSerializer(user).data)


class DemoUsersView(APIView):
    """Demo accounts for one-click login."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(responses={200: DemoUserSerializer(many=True), 404: ErrorSerializer})
    def get(self, request):
        """List demo users."""
        return Response(DemoUserSerializer(services.list_demo_users(), many=True).data)


class DemoLoginView(APIView):
    """One-click login as a demo user."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    @extend_schema(
        request=DemoLoginSerializer,
        responses={200: UserSerializer, 404: ErrorSerializer, 429: ErrorSerializer},
    )
    def post(self, request):
        """Log in as a demo user."""
        _enforce_csrf(request)
        data = DemoLoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = services.demo_login(request, data.validated_data["username"])
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    """End the session."""

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        """Log out."""
        django_logout(request)
        return Response(status=204)


class AdminUsersView(APIView):
    """Every user with their activity, for the admin Users tab."""

    @extend_schema(
        operation_id="admin_users_list",
        responses={200: AdminUserSerializer(many=True), 401: ErrorSerializer, 403: ErrorSerializer},
    )
    def get(self, request):
        """List users with submission and review counts (admins only)."""
        users = services.list_users_with_activity(request.user)
        return Response(AdminUserSerializer(users, many=True).data)
