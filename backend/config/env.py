"""Tiny .env loader and typed env readers; real environment variables always win."""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_dotenv(path: Path | None = None) -> None:
    """Load KEY=VALUE lines from the repo-root .env without overriding existing variables."""
    path = path or REPO_ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def env_bool(name: str, default: bool) -> bool:
    """Read a boolean env var ("true"/"1"/"yes" are true)."""
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    """Read a comma-separated env var as a list of non-empty strings."""
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]
