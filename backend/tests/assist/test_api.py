import pytest

URL = "/api/v1/documents/{}/assist"


def test_api_shape(api_client, reviewer, submitter, make_document, auth, fake, valid_report):
    """The assist endpoint returns the report with the advisory notice."""
    fake([valid_report])
    doc = make_document(submitter)
    r = auth(api_client, reviewer).post(URL.format(doc.id))
    body = r.json()
    assert r.status_code == 200 and body["status"] == "ok"
    assert body["notice"] == "Advisory only. You make the decision."
    assert {"provider", "model", "cached", "generated_at", "report", "reason", "message"} <= set(
        body
    )


def test_api_fallback_is_200(api_client, reviewer, submitter, make_document, auth, settings):
    """Fallbacks are a 200 so the page never breaks."""
    settings.AI_PROVIDER = "none"
    r = auth(api_client, reviewer).post(URL.format(make_document(submitter).id))
    assert r.status_code == 200 and r.json()["status"] == "unavailable"
    assert r.json()["reason"] == "not_configured"


def test_api_refresh_param(
    api_client, reviewer, submitter, make_document, auth, fake, valid_report
):
    """?refresh=true regenerates."""
    provider = fake([valid_report, valid_report])
    doc = make_document(submitter)
    client = auth(api_client, reviewer)
    client.post(URL.format(doc.id))
    assert client.post(URL.format(doc.id) + "?refresh=true").json()["cached"] is False
    assert provider.calls == 2


def test_api_submitter_403(api_client, submitter, make_document, auth, fake):
    """Submitters can't call AI Assist."""
    fake()
    r = auth(api_client, submitter).post(URL.format(make_document(submitter).id))
    assert r.status_code == 403 and r.json()["error"]["code"] == "permission_denied"


@pytest.mark.parametrize("bad", ["nope", "00000000-0000-0000-0000-000000000000"])
def test_api_bad_id_404(api_client, reviewer, auth, fake, bad):
    """Unknown ids are 404s."""
    fake()
    assert auth(api_client, reviewer).post(URL.format(bad)).status_code == 404


def test_api_throttle(api_client, reviewer, submitter, make_document, auth, fake, valid_report):
    """The 21st assist call in an hour is throttled."""
    fake([valid_report])
    doc = make_document(submitter)
    client = auth(api_client, reviewer)
    for _ in range(20):
        assert client.post(URL.format(doc.id)).status_code == 200
    r = client.post(URL.format(doc.id))
    assert r.status_code == 429 and r.json()["error"]["code"] == "throttled"
