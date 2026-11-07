"""Create the database named in DATABASE_URL on local Postgres if it is missing."""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import psycopg
from psycopg import sql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config.env import load_dotenv  # noqa: E402


def main() -> None:
    """Connect to the server's `postgres` database and create the target database."""
    load_dotenv()
    url = os.environ.get("DATABASE_URL", "")
    if not url.startswith("postgres"):
        print("DATABASE_URL is not Postgres; nothing to create.")
        return
    parsed = urlparse(url)
    name = parsed.path.lstrip("/")
    admin_url = urlunparse(parsed._replace(path="/postgres"))
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", [name]).fetchone()
        if exists:
            print(f"Database {name} already exists.")
        else:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
            print(f"Created database {name}.")


if __name__ == "__main__":
    main()
