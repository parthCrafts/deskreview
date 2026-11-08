"""Request and response shapes for the auth API."""

from drf_spectacular.utils import extend_schema_field
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


class SubmissionCountsSerializer(serializers.Serializer):
    """How many documents a user submitted, by status."""

    total = serializers.IntegerField()
    pending = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()


class ReviewCountsSerializer(serializers.Serializer):
    """How many decisions a user made, by outcome."""

    total = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()


class AdminUserSerializer(serializers.ModelSerializer):
    """A user as the admin Users tab shows it, with activity counts."""

    submissions = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "display_name",
            "role",
            "is_active",
            "is_demo",
            "date_joined",
            "last_login",
            "submissions",
            "reviews",
        ]

    @extend_schema_field(SubmissionCountsSerializer)
    def get_submissions(self, user: User) -> dict:
        """Submitted documents by status (annotated by the service)."""
        return {
            "total": user.submitted_total,
            "pending": user.submitted_pending,
            "approved": user.submitted_approved,
            "rejected": user.submitted_rejected,
        }

    @extend_schema_field(ReviewCountsSerializer)
    def get_reviews(self, user: User) -> dict:
        """Decisions made, by outcome (annotated by the service)."""
        return {
            "total": user.reviewed_approved + user.reviewed_rejected,
            "approved": user.reviewed_approved,
            "rejected": user.reviewed_rejected,
        }


class LoginSerializer(serializers.Serializer):
    """Username and password."""

    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=256, trim_whitespace=False)


class DemoLoginSerializer(serializers.Serializer):
    """The demo username to log in as."""

    username = serializers.CharField(max_length=150)
