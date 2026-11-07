"""Request and response shapes for the auth API."""

from rest_framework import serializers

from apps.accounts.models import User


class UserSerializer(serializers.ModelSerializer):
    """The current user as the SPA sees it."""

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "role"]


class DemoUserSerializer(serializers.ModelSerializer):
    """A demo user offered on the login page."""

    class Meta:
        model = User
        fields = ["username", "display_name", "role"]


class LoginSerializer(serializers.Serializer):
    """Username and password."""

    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=256, trim_whitespace=False)


class DemoLoginSerializer(serializers.Serializer):
    """The demo username to log in as."""

    username = serializers.CharField(max_length=150)
