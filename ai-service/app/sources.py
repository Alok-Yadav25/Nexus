"""An extensible, identity-preserving registry. Search results are candidates, not facts."""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from functools import lru_cache
from threading import Lock
from urllib.parse import urlencode, urlsplit
import json
import os
import time
from .security import SafeFetcher, RESEARCH_CONTACT, MAX_BYTES, SourceHTTPError

_buckets_lock = Lock()
_buckets = {}


def provider_bucket(url):
    host = urlsplit(url).hostname or ""
    key = (
        "wikimedia"
        if host in {"en.wikipedia.org", "www.wikidata.org", "commons.wikimedia.org"}
        else host
    )
    with _buckets_lock:
        return _buckets.setdefault(key, {"lock": Lock(), "last": 0.0, "cooldown": 0.0})


def document(url, max_bytes=MAX_BYTES):
    bucket = provider_bucket(url)
    if not bucket["lock"].acquire(timeout=5):
        raise ValueError("Knowledge provider busy; please try again shortly")
    try:
        if time.monotonic() < bucket["cooldown"]:
            raise ValueError(
                "Knowledge provider is cooling down; please try again later"
            )
        time.sleep(
            max(
                0,
                (1.1 if RESEARCH_CONTACT else 6.1)
                - (time.monotonic() - bucket["last"]),
            )
        )
        try:
            raw, final = SafeFetcher()._raw(url, max_bytes=max_bytes)
            payload = json.loads(raw)
            if payload.get("error"):
                error = payload["error"]
                if isinstance(error, dict) and error.get("code") in {
                    "nosuchpageid",
                    "missingtitle",
                    "nosuchpage",
                }:
                    raise SourceHTTPError(404)
                raise ValueError("Knowledge provider temporarily rejected the request")
            return payload, final
        except SourceHTTPError as exc:
            if exc.status in {429, 503}:
                bucket["cooldown"] = time.monotonic() + max(
                    6.1, exc.retry_after if exc.retry_after is not None else 60
                )
            raise
        finally:
            bucket["last"] = time.monotonic()
    finally:
        bucket["lock"].release()


class KnowledgeSourceAdapter(ABC):
    name: str

    @abstractmethod
    def search(self, query): ...


class WikidataAdapter(KnowledgeSourceAdapter):
    name = "Wikidata"

    def search(self, query):
        data, _ = document(
            "https://www.wikidata.org/w/api.php?"
            + urlencode(
                {
                    "action": "wbsearchentities",
                    "search": query,
                    "language": "en",
                    "uselang": "en",
                    "type": "item",
                    "limit": 8,
                    "format": "json",
                }
            )
        )
        return [
            {
                "provider": self.name,
                "id": entry["id"],
                "title": entry.get("label", entry["id"]),
                "description": entry.get("description", ""),
                "url": "https://www.wikidata.org/wiki/" + entry["id"],
                "license": "CC0 structured data",
                "state": "IDENTITY_CANDIDATE",
            }
            for entry in data.get("search", [])
            if __import__("re").fullmatch(r"Q[1-9][0-9]*", entry.get("id", ""))
        ]


class WikipediaAdapter(KnowledgeSourceAdapter):
    name = "Wikipedia"

    def search(self, query):
        data, _ = document(
            "https://en.wikipedia.org/w/api.php?"
            + urlencode(
                {
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srnamespace": 0,
                    "srlimit": 6,
                    "srprop": "",
                    "format": "json",
                    "formatversion": 2,
                }
            )
        )
        return [
            {
                "provider": self.name,
                "id": "enwiki:" + str(entry["pageid"]),
                "title": entry["title"],
                "description": "Candidate encyclopedia entry; select and inspect its sources",
                "url": "https://en.wikipedia.org/?curid=" + str(entry["pageid"]),
                "license": "CC BY-SA; original attribution and licensing apply",
                "state": "DISCOVERY_CANDIDATE",
            }
            for entry in data.get("query", {}).get("search", [])
        ]


class CrossrefAdapter(KnowledgeSourceAdapter):
    name = "Crossref"

    def search(self, query):
        data, _ = document(
            "https://api.crossref.org/works?"
            + urlencode(
                {
                    "query.bibliographic": query,
                    "rows": 3,
                    "select": "DOI,title,publisher,published,URL,type",
                }
            )
        )
        return [
            {
                "provider": self.name,
                "id": "doi:" + entry["DOI"],
                "title": (entry.get("title") or [entry["DOI"]])[0],
                "description": entry.get("publisher", "Scholarly metadata"),
                "url": "https://doi.org/" + entry["DOI"],
                "license": "Bibliographic metadata; linked content rights are separate",
                "state": "PUBLICATION_CANDIDATE",
            }
            for entry in data.get("message", {}).get("items", [])
        ]


REGISTRY = (WikidataAdapter(), WikipediaAdapter(), CrossrefAdapter())


@lru_cache(maxsize=256)
def resolve(query, cache_epoch=None):
    candidates, warnings = [], []
    for adapter in REGISTRY:
        try:
            candidates.extend(adapter.search(query))
        except (ValueError, OSError, KeyError):
            warnings.append(adapter.name + " is temporarily unavailable")
    return {
        "query": query,
        "candidates": candidates,
        "warnings": warnings,
        "state": "CANDIDATES"
        if candidates
        else "PROVIDERS_UNAVAILABLE"
        if warnings
        else "NO_EVIDENCE",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "notice": "Candidates are not verified NEXUS articles. Similar labels can identify different subjects; no candidates are merged or auto-published.",
    }


@lru_cache(maxsize=256)
def canonical_title(identifier):
    import re

    if re.fullmatch(r"wikidata:Q[1-9][0-9]*", identifier):
        qid = identifier.split(":")[1]
        payload, _ = document(
            "https://www.wikidata.org/w/api.php?"
            + urlencode(
                {
                    "action": "wbgetentities",
                    "ids": qid,
                    "props": "sitelinks",
                    "sitefilter": "enwiki",
                    "format": "json",
                }
            )
        )
        title = (
            payload.get("entities", {})
            .get(qid, {})
            .get("sitelinks", {})
            .get("enwiki", {})
            .get("title")
        )
    elif re.fullmatch(r"enwiki:[1-9][0-9]*", identifier):
        payload, _ = document(
            "https://en.wikipedia.org/w/api.php?"
            + urlencode(
                {
                    "action": "query",
                    "pageids": identifier.split(":")[1],
                    "prop": "info",
                    "format": "json",
                    "formatversion": 2,
                }
            )
        )
        pages = payload.get("query", {}).get("pages", [])
        title = pages[0].get("title") if pages and not pages[0].get("missing") else None
    else:
        raise ValueError("Invalid canonical identity")
    if not title:
        raise ValueError(
            "The selected identity has no available English encyclopedia source; it was not silently replaced"
        )
    return title
