def test_spa_routes_serve_index(client, settings, tmp_path, db):
    """Client-side routes get the SPA shell, never cached."""
    (tmp_path / "index.html").write_text("<!doctype html><div id=root></div>")
    settings.FRONTEND_DIST = tmp_path
    for url in ("/", "/review/123", "/documents?status=approved", "/login"):
        r = client.get(url)
        assert r.status_code == 200 and b"id=root" in r.content
        assert r["Cache-Control"] == "no-cache"
        assert r["Content-Type"].startswith("text/html")


def test_api_paths_still_json_404(client, settings, tmp_path, db):
    """Unknown API paths are not swallowed by the SPA fallback."""
    (tmp_path / "index.html").write_text("<html></html>")
    settings.FRONTEND_DIST = tmp_path
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_missing_build_is_helpful_404(client, settings, tmp_path, db):
    """Without a frontend build, the fallback explains how to build it."""
    settings.FRONTEND_DIST = tmp_path / "missing"
    r = client.get("/review")
    assert r.status_code == 404 and b"make build" in r.content
