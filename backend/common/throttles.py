"""Named throttles; rates live in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]."""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    """Per-IP limit on password and demo logins."""

    scope = "login"


class UploadThrottle(UserRateThrottle):
    """Per-user limit on document submissions."""

    scope = "upload"


class AssistThrottle(UserRateThrottle):
    """Per-user limit on AI Assist generations."""

    scope = "assist"
