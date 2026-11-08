"""Settings for tests and CI checks: a throwaway key and the fake AI provider.

AI settings are forced (not defaulted) so a real key in .env or the shell can never make a
test call a live model. tests/conftest.py also blocks the Gemini client outright.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-only-not-secret")
os.environ["AI_PROVIDER"] = "fake"
os.environ["GEMINI_API_KEY"] = ""

from config.settings import *  # noqa: E402, F403
