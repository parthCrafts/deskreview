from rest_framework.test import APIClient

from apps.accounts.models import User


def test_me_unauthenticated_401(api_client):
    """Anonymous /me is a 401 envelope."""
    r = api_client.get("/api/v1/auth/me")
    assert r.status_code == 401 and r.json()["error"]["code"] == "not_authenticated"


def test_me_sets_csrf_cookie(api_client):
    """/me always sets the CSRF cookie so the SPA can make unsafe requests."""
    assert "csrftoken" in api_client.get("/api/v1/auth/me").cookies


def test_login_success_sets_session(api_client, submitter):
    """Valid credentials log the user in."""
    r = api_client.post(
        "/api/v1/auth/login", {"username": "alice", "password": "pw"}, format="json"
    )
    assert r.status_code == 200 and r.json()["role"] == "submitter"
    assert set(r.json()) == {"id", "username", "display_name", "role"}
    assert api_client.get("/api/v1/auth/me").json()["username"] == "alice"


def test_login_bad_password_400(api_client, submitter):
    """Wrong password is a 400 invalid_credentials."""
    r = api_client.post(
        "/api/v1/auth/login", {"username": "alice", "password": "nope"}, format="json"
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_credentials"


def test_login_missing_fields_400_fields(api_client):
    """Missing fields are reported per field."""
    r = api_client.post("/api/v1/auth/login", {}, format="json")
    assert r.status_code == 400
    assert set(r.json()["error"]["fields"]) == {"username", "password"}


def test_demo_users_listed(api_client, submitter, reviewer, settings):
    """Demo users are listed for the one-click login buttons, never with a password."""
    settings.DEMO_LOGIN_ENABLED = True
    User.objects.create_user("eve", password="x", role="submitter", is_demo=False)
    r = api_client.get("/api/v1/auth/demo-users")
    assert r.status_code == 200
    assert [u["username"] for u in r.json()] == ["rita", "alice"]
    assert set(r.json()[0]) == {"username", "display_name", "role"}


def test_demo_login_only_demo_users(api_client, submitter, settings):
    """Demo login works only for demo users."""
    settings.DEMO_LOGIN_ENABLED = True
    r = api_client.post("/api/v1/auth/demo-login", {"username": "alice"}, format="json")
    assert r.status_code == 200 and r.json()["username"] == "alice"
    User.objects.create_user("eve", password="x", role="submitter", is_demo=False)
    r = api_client.post("/api/v1/auth/demo-login", {"username": "eve"}, format="json")
    assert r.status_code == 404


def test_demo_disabled_404(api_client, submitter, settings):
    """With demo login disabled, both demo endpoints are 404."""
    settings.DEMO_LOGIN_ENABLED = False
    assert api_client.get("/api/v1/auth/demo-users").status_code == 404
    r = api_client.post("/api/v1/auth/demo-login", {"username": "alice"}, format="json")
    assert r.status_code == 404


def test_login_throttled_429(api_client, submitter):
    """The 11th login attempt in a minute is throttled."""
    for _ in range(10):
        api_client.post(
            "/api/v1/auth/login", {"username": "alice", "password": "bad"}, format="json"
        )
    r = api_client.post(
        "/api/v1/auth/login", {"username": "alice", "password": "bad"}, format="json"
    )
    assert r.status_code == 429 and r.json()["error"]["code"] == "throttled"
    assert r.json()["error"]["details"]["retry_after"] > 0


def test_csrf_enforced_for_session_posts(submitter):
    """Unsafe requests with a session but no CSRF token are refused."""
    c = APIClient(enforce_csrf_checks=True)
    c.force_login(submitter)
    r = c.post("/api/v1/auth/logout")
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


def test_logout_204(api_client, submitter, auth):
    """Logout ends the session."""
    client = auth(api_client, submitter)
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_requires_auth(api_client):
    """Anonymous logout is a 401."""
    assert api_client.post("/api/v1/auth/logout").status_code == 401


def _csrf_client() -> tuple[APIClient, str]:
    """A client that enforces CSRF like a browser, plus a token from /me."""
    client = APIClient(enforce_csrf_checks=True)
    return client, client.get("/api/v1/auth/me").cookies["csrftoken"].value


def test_login_without_csrf_token_is_rejected(submitter):
    """A cross-site form cannot log a victim into another account (login CSRF)."""
    client, _ = _csrf_client()
    r = client.post("/api/v1/auth/login", {"username": "alice", "password": "pw"}, format="json")
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


def test_demo_login_without_csrf_token_is_rejected(submitter, settings):
    """Demo login needs the CSRF token too."""
    settings.DEMO_LOGIN_ENABLED = True
    client, _ = _csrf_client()
    r = client.post("/api/v1/auth/demo-login", {"username": "alice"}, format="json")
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


def test_login_with_csrf_token_succeeds(submitter):
    """The SPA's flow (token from /me, sent as X-CSRFToken) still logs in."""
    client, token = _csrf_client()
    r = client.post(
        "/api/v1/auth/login",
        {"username": "alice", "password": "pw"},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert r.status_code == 200
