import pytest

URL = "/api/v1/documents"


def test_submitter_sees_only_own(api_client, submitter, other_submitter, make_document, auth):
    """Submitters only ever see their own documents, even with scope=all."""
    make_document(submitter)
    make_document(other_submitter)
    body = auth(api_client, submitter).get(URL, {"scope": "all"}).json()
    assert body["count"] == 1
    assert all(d["submitter"]["username"] == "alice" for d in body["results"])


def test_reviewer_sees_all_with_counts(
    api_client, reviewer, submitter, other_submitter, make_document, auth
):
    """Reviewers see everything; counts ignore the status filter."""
    make_document(submitter)
    make_document(other_submitter, status="approved", decided_by=reviewer)
    body = auth(api_client, reviewer).get(URL, {"status": "pending"}).json()
    assert body["count"] == 1 and body["results"][0]["status"] == "pending"
    assert body["counts"] == {"all": 2, "pending": 1, "approved": 1, "rejected": 0}


def test_reviewer_scope_mine(api_client, reviewer, submitter, make_document, auth):
    """A reviewer's scope=mine lists only their own submissions."""
    make_document(submitter)
    make_document(reviewer, title="Mine")
    body = auth(api_client, reviewer).get(URL, {"scope": "mine"}).json()
    assert [d["title"] for d in body["results"]] == ["Mine"]


def test_list_summary_shape(api_client, submitter, make_document, auth):
    """Summaries omit text and events."""
    make_document(submitter)
    item = auth(api_client, submitter).get(URL).json()["results"][0]
    assert "text" not in item and "events" not in item
    assert {"id", "title", "kind", "status", "submitter", "file", "created_at"} <= set(item)


def test_newest_first(api_client, submitter, make_document, auth):
    """Lists are newest first."""
    make_document(submitter, title="old")
    make_document(submitter, title="new")
    titles = [d["title"] for d in auth(api_client, submitter).get(URL).json()["results"]]
    assert titles == ["new", "old"]


def test_search_title_and_submitter(
    api_client, reviewer, submitter, other_submitter, make_document, auth
):
    """q matches title, username or display name, case-insensitively."""
    make_document(submitter, title="Vendor contract")
    make_document(other_submitter, title="Budget")
    client = auth(api_client, reviewer)
    assert client.get(URL, {"q": "VENDOR"}).json()["count"] == 1
    assert client.get(URL, {"q": "okafor"}).json()["count"] == 1
    assert client.get(URL, {"q": "ben"}).json()["count"] == 1


def test_search_literal_wildcards(api_client, reviewer, submitter, make_document, auth):
    """SQL wildcard characters are matched literally."""
    make_document(submitter, title="100% done")
    make_document(submitter, title="other_thing")
    make_document(submitter, title="plain")
    client = auth(api_client, reviewer)
    assert client.get(URL, {"q": "%"}).json()["count"] == 1
    assert client.get(URL, {"q": "_"}).json()["count"] == 1
    assert client.get(URL, {"q": "\\"}).json()["count"] == 0


def test_q_too_long_400(api_client, reviewer, auth):
    """q is capped at 100 characters."""
    r = auth(api_client, reviewer).get(URL, {"q": "x" * 101})
    assert r.status_code == 400 and "q" in r.json()["error"]["fields"]


@pytest.mark.parametrize(
    "params,field",
    [
        ({"status": "bogus"}, "status"),
        ({"scope": "everyone"}, "scope"),
        ({"page": "0"}, "page"),
        ({"page": "x"}, "page"),
        ({"page_size": "51"}, "page_size"),
    ],
)
def test_invalid_filters_400(api_client, reviewer, auth, params, field):
    """Bad filter values are field errors."""
    r = auth(api_client, reviewer).get(URL, params)
    assert r.status_code == 400 and field in r.json()["error"]["fields"]


def test_pagination(api_client, submitter, make_document, auth):
    """Pages carry numeric next/previous links."""
    for i in range(3):
        make_document(submitter, title=f"d{i}")
    client = auth(api_client, submitter)
    first = client.get(URL, {"page_size": 2}).json()
    assert len(first["results"]) == 2 and first["next"] == 2 and first["previous"] is None
    second = client.get(URL, {"page_size": 2, "page": 2}).json()
    assert len(second["results"]) == 1 and second["next"] is None and second["previous"] == 1


def test_page_past_end_empty_200(api_client, reviewer, submitter, make_document, auth):
    """A page past the end is an empty 200, not an error."""
    make_document(submitter)
    r = auth(api_client, reviewer).get(URL, {"page": 5})
    body = r.json()
    assert r.status_code == 200 and body["results"] == [] and body["count"] == 1
    assert body["page"] == 5 and body["next"] is None


def test_list_unauthenticated_401(api_client):
    """Listing needs a session."""
    assert api_client.get(URL).status_code == 401
