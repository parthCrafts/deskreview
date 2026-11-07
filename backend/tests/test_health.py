def test_health_ok(client, db):
    """Health check reports the app and database as ok."""
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok"}


def test_health_ignores_host_header(client, db, settings):
    """Platform health probes may use an internal Host; the check must still answer."""
    settings.ALLOWED_HOSTS = ["deskreview.example.com"]
    r = client.get("/api/health", HTTP_HOST="10.0.0.12:10000")
    assert r.status_code == 200 and r.json()["db"] == "ok"


def test_gunicorn_serves_concurrent_requests_while_ai_calls_wait():
    """Slow AI calls must not take every worker: threads give at least 8 concurrent slots."""
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "gunicorn.conf.py"
    spec = importlib.util.spec_from_file_location("gunicorn_conf", path)
    conf = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(conf)
    assert conf.worker_class == "gthread"
    assert conf.workers * conf.threads >= 8
    assert conf.timeout > 2 * 25
