from urllib.parse import parse_qs, urlsplit

import pytest

from app import encyclopedia as wiki
from app import sources
from app.security import SourceHTTPError


def test_successful_http_response_with_missing_page_error_still_becomes_404(
    monkeypatch,
):
    monkeypatch.setattr(sources.time, "sleep", lambda _: None)
    monkeypatch.setattr(
        sources.SafeFetcher,
        "_raw",
        lambda *args, **kwargs: (
            b'{"error":{"code":"nosuchpageid"}}',
            "https://en.wikipedia.org/w/api.php",
        ),
    )
    with pytest.raises(SourceHTTPError) as error:
        sources.document("https://en.wikipedia.org/w/api.php")
    assert error.value.status == 404


@pytest.mark.parametrize(
    "query",
    [
        "granite",
        "Internet",
        "Shah Rukh Khan",
        "MrBeast",
        "Breaking Bad",
        "Roman Empire",
        "quartz",
        "π",
    ],
)
def test_search_has_no_subject_whitelist_and_preserves_provider_paging(
    monkeypatch, query
):
    calls = []

    def provider(url):
        calls.append(parse_qs(urlsplit(url).query))
        return {
            "query": {
                "pages": [
                    {"pageid": 2, "title": "Second match", "index": 2},
                    {
                        "pageid": 1,
                        "title": query,
                        "description": "Actual provider description",
                        "index": 1,
                    },
                ]
            },
            "continue": {"gsroffset": 24, "continue": "gsroffset||"},
        }, url

    monkeypatch.setattr(wiki, "document", provider)
    result = wiki.search(query, 12)
    assert calls[0]["gsrsearch"] == [query]
    assert calls[0]["gsroffset"] == ["12"]
    assert result["items"][0]["title"] == query
    assert result["nextOffset"] == 24
    assert result["items"][0]["description"] == "Actual provider description"


def test_article_tree_keeps_references_and_removes_executable_content():
    html = """<body><script>alert(1)</script><p onclick="bad()">A rock
    <sup id="cite_ref-1"><a href="./Granite#cite_note-1">[1]</a></sup>
    <a href="./Quartz">quartz</a><a href="javascript:alert(1)">bad</a></p>
    <h2 id="References">References</h2><ol><li id="cite_note-1">
    <a href="https://example.org/paper">Paper</a><a href="./Granite#cite_ref-1">↑</a>
    </li></ol><img src="secret" onerror="bad()"><math alttext="E=mc^2"></math></body>"""
    content, toc, truncated = wiki.article_tree(html, "Granite")
    serialized = __import__("json").dumps(content)
    assert "onclick" not in serialized and "script" not in serialized
    assert "javascript:" not in serialized and "onerror" not in serialized
    assert '"href": "#wiki-cite_note-1"' in serialized
    assert '"id": "wiki-cite_note-1"' in serialized
    assert '"href": "/read/wikipedia?title=Quartz"' in serialized
    assert "https://example.org/paper" in serialized
    assert "E=mc^2" in serialized
    assert toc == [{"id": "wiki-References", "title": "References", "level": 2}]
    assert not truncated


def test_article_uses_latest_rest_and_preserves_license_revision(monkeypatch):
    def provider(url, max_bytes):
        assert "/v1/page/Breaking_Bad/with_html" in url
        assert max_bytes == 8_000_000
        return {
            "id": 42,
            "title": "Breaking Bad",
            "content_model": "wikitext",
            "latest": {"id": 567, "timestamp": "2026-11-10T00:00:00Z"},
            "license": {
                "title": "CC BY-SA 4.0",
                "url": "https://creativecommons.org/licenses/by-sa/4.0/",
            },
            "html": "<body><p>Provider article text.</p></body>",
        }, url

    monkeypatch.setattr(wiki, "document", provider)
    article = wiki.article("Breaking Bad")
    assert article["revisionId"] == 567
    assert article["revisionUrl"].endswith("oldid=567")
    assert article["attribution"] == "Wikipedia contributors"
    assert article["license"]["title"] == "CC BY-SA 4.0"


def test_category_cursor_round_trip_and_arbitrary_subtopics(monkeypatch):
    continuation = {"cmcontinue": "subcat|MINERALS|123", "continue": "-||"}

    def provider(**params):
        assert params["cmtitle"] == "Category:Minerals"
        assert params["cmcontinue"] == continuation["cmcontinue"]
        return {
            "query": {
                "categorymembers": [
                    {"pageid": 7, "ns": 0, "title": "Quartz"},
                    {"pageid": 8, "ns": 14, "title": "Category:Silicates"},
                ]
            },
            "continue": continuation,
        }

    monkeypatch.setattr(wiki, "action", provider)
    result = wiki.topics("Minerals", wiki.encode_cursor(continuation))
    assert [p["kind"] for p in result["items"]] == ["ARTICLE", "CATEGORY"]
    assert result["items"][1]["label"] == "Silicates"
    assert wiki.decode_cursor(result["nextCursor"]) == continuation


@pytest.mark.parametrize(
    "value",
    [
        "not-json",
        wiki.encode_cursor({"url": "https://evil.test"}),
        wiki.encode_cursor(["bad"]),
        "a" * 2001,
    ],
)
def test_invalid_topic_cursor_is_rejected(value):
    with pytest.raises(ValueError):
        wiki.decode_cursor(value)


def test_cross_article_fragments_and_namespaces():
    assert (
        wiki.article_link("./Quartz?oldid=123#Structure", "Granite")
        == "https://en.wikipedia.org/wiki/Quartz?oldid=123#Structure"
    )
    assert (
        wiki.article_link("./Quartz#Structure", "Granite")
        == "/read/wikipedia?title=Quartz#wiki-Structure"
    )
    assert (
        wiki.article_link("./Category:Minerals", "Granite")
        == "/explore?category=Minerals"
    )
    assert wiki.article_link("data:text/html,bad", "Granite") is None
    assert wiki.article_link("https://name:pass@example.org/", "Granite") is None


def test_truncated_article_never_advertises_missing_sections():
    content, toc, truncated = wiki.article_tree(
        "<body>" + "<p>x</p>" * 16000 + '<h2 id="Late">Late</h2></body>', "Test"
    )
    assert truncated
    assert all(section["id"] != "wiki-Late" for section in toc)


def test_provider_cooldown_is_shared_for_wikimedia_but_not_crossref(monkeypatch):
    monkeypatch.setattr(sources, "_buckets", {})
    monkeypatch.setattr(sources.time, "sleep", lambda _: None)
    monkeypatch.setattr(sources.time, "monotonic", lambda: 100.0)
    calls = []

    def unavailable(*args, **kwargs):
        calls.append(1)
        raise SourceHTTPError(429, 120)

    monkeypatch.setattr(sources.SafeFetcher, "_raw", unavailable)
    with pytest.raises(SourceHTTPError):
        sources.document("https://en.wikipedia.org/w/api.php")
    with pytest.raises(ValueError, match="cooling down"):
        sources.document("https://www.wikidata.org/w/api.php")
    assert len(calls) == 1
    assert sources.provider_bucket("https://api.crossref.org/works")["cooldown"] == 0


def test_busy_provider_does_not_wait_indefinitely(monkeypatch):
    class BusyLock:
        def acquire(self, timeout):
            assert timeout == 5
            return False

    monkeypatch.setattr(sources, "provider_bucket", lambda _: {"lock": BusyLock()})
    with pytest.raises(ValueError, match="busy"):
        sources.document("https://en.wikipedia.org/w/api.php")
    assert (
        wiki.article_link("./Star_Trek:_Discovery", "Granite")
        == "/read/wikipedia?title=Star+Trek%3A+Discovery"
    )
