SHELL := /bin/bash
BACKEND := cd backend &&
FRONTEND := cd frontend &&

# Production-like settings shared by prod-local and the E2E server.
PROD_ENV := DEBUG=false SECURE_COOKIES=false SECRET_KEY=local-prod-check \
	ALLOWED_HOSTS=127.0.0.1,localhost FILE_STORAGE=database DEMO_LOGIN_ENABLED=true
E2E_ENV := $(PROD_ENV) DATABASE_URL=sqlite:///$(CURDIR)/.e2e/db.sqlite3 AI_PROVIDER=fake GEMINI_API_KEY= \
	CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8001 LOG_LEVEL=WARNING

.PHONY: setup db migrate seed dev dev-backend dev-frontend build prod-local e2e-server \
	test test-backend test-frontend test-e2e lint lint-backend lint-frontend

setup:
	$(BACKEND) uv sync
	$(FRONTEND) [ -d node_modules ] || npm ci

db:
	$(BACKEND) uv run python scripts/create_db.py

migrate:
	$(BACKEND) uv run python manage.py migrate && uv run python manage.py createcachetable

seed:
	$(BACKEND) uv run python manage.py seed_demo

dev:
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	$(BACKEND) uv run python manage.py runserver 8000

dev-frontend:
	$(FRONTEND) npm run dev

build:
	$(FRONTEND) npm run build

prod-local: build
	$(BACKEND) $(PROD_ENV) uv run python manage.py collectstatic --noinput -v0
	$(BACKEND) $(PROD_ENV) uv run python manage.py migrate -v0
	$(BACKEND) $(PROD_ENV) uv run python manage.py createcachetable
	$(BACKEND) $(PROD_ENV) uv run python manage.py seed_demo
	$(BACKEND) $(PROD_ENV) uv run gunicorn config.wsgi -b 127.0.0.1:8000

e2e-server: build
	mkdir -p .e2e
	$(BACKEND) $(E2E_ENV) uv run python manage.py collectstatic --noinput -v0
	$(BACKEND) $(E2E_ENV) uv run python manage.py migrate -v0
	$(BACKEND) $(E2E_ENV) uv run python manage.py createcachetable
	$(BACKEND) $(E2E_ENV) uv run python manage.py seed_demo --reset
	$(BACKEND) $(E2E_ENV) uv run gunicorn config.wsgi -b 127.0.0.1:8001

test: setup lint test-backend test-frontend test-e2e

test-backend:
	$(BACKEND) uv run pytest

test-frontend:
	$(FRONTEND) npm run test

test-e2e:
	$(FRONTEND) npx playwright install chromium && npx playwright test

lint: lint-backend lint-frontend

lint-backend:
	$(BACKEND) uv run ruff check . && uv run ruff format --check . \
		&& DJANGO_SETTINGS_MODULE=config.test_settings uv run python manage.py makemigrations --check --dry-run -v0 \
		&& DJANGO_SETTINGS_MODULE=config.test_settings uv run python manage.py spectacular --validate --fail-on-warn --file /dev/null

lint-frontend:
	$(FRONTEND) npm run lint && npm run typecheck
