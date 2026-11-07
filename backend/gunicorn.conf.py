"""Gunicorn settings: threaded workers so a slow AI call doesn't block other requests."""

import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = 2
worker_class = "gthread"
threads = 4
timeout = 60
