"""Settings for tests and CI checks: a throwaway key and the fake AI provider."""

import os

os.environ.setdefault("SECRET_KEY", "test-only-not-secret")
os.environ.setdefault("AI_PROVIDER", "fake")

from config.settings import *  # noqa: E402, F403
