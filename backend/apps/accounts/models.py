"""User model with an application role."""

from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    """The application roles."""

    SUBMITTER = "submitter", "Submitter"
    REVIEWER = "reviewer", "Reviewer"
    ADMIN = "admin", "Admin"


class User(AbstractUser):
    """An application user; reviewers can also submit documents."""

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SUBMITTER)
    display_name = models.CharField(max_length=120, blank=True)
    is_demo = models.BooleanField(default=False)

    @property
    def is_reviewer(self) -> bool:
        """Whether this user may review documents."""
        return self.role == Role.REVIEWER

    @property
    def is_admin(self) -> bool:
        """Whether this user oversees everything (read-only: admins never decide documents)."""
        return self.role == Role.ADMIN

    @property
    def sees_all_documents(self) -> bool:
        """Reviewers and admins see every document; submitters only their own."""
        return self.is_reviewer or self.is_admin

    def __str__(self) -> str:
        """Show the display name, falling back to the username."""
        return self.display_name or self.username
