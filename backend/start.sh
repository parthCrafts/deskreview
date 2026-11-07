#!/bin/sh
# Container entrypoint: migrate, repair the demo data, then serve.
set -e
python manage.py migrate --noinput
python manage.py createcachetable
python manage.py seed_demo
exec gunicorn config.wsgi
