"""Bounded HTTPS with public DNS validation and connection pinning."""

import http.client
import os
import ipaddress
import socket
import ssl
import truststore
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urljoin
from urllib.robotparser import RobotFileParser

APPROVED_HOSTS = frozenset(
    {
        "en.wikipedia.org",
        "ssd.jpl.nasa.gov",
        "pds-rings.seti.org",
        "pubchem.ncbi.nlm.nih.gov",
        "www.wikidata.org",
        "api.crossref.org",
        "commons.wikimedia.org",
        "export.arxiv.org",
        "arxiv.org",
        "science.nasa.gov",
        "www.nasa.gov",
        "periodic-table.rsc.org",
        "www.nobelprize.org",
        "www.marvel.com",
    }
)
MAX_BYTES = 2_000_000
RESEARCH_CONTACT = os.getenv("NEXUS_RESEARCH_CONTACT", "").strip()
if len(RESEARCH_CONTACT) > 200 or any(c in RESEARCH_CONTACT for c in "\r\n"):
    RESEARCH_CONTACT = ""
USER_AGENT = (
    "NexusResearch/0.2 (evidence research"
    + ("; " + RESEARCH_CONTACT if RESEARCH_CONTACT else "")
    + ")"
)


def validate_url(url):
    p = urlsplit(url)
    if (
        p.scheme != "https"
        or p.port not in (None, 443)
        or p.username
        or p.password
        or not p.hostname
    ):
        raise ValueError("Only public HTTPS port 443 is permitted")
    host = p.hostname.lower().rstrip(".")
    if host not in APPROVED_HOSTS:
        raise ValueError("Source host is not approved")
    ips = sorted(
        {x[4][0] for x in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
    )
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise ValueError("Private or reserved source address")
    return host, (p.path or "/") + ("?" + p.query if p.query else ""), ips


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, address):
        super().__init__(
            host, timeout=12, context=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        )
        self.address = address

    def connect(self):
        raw = socket.create_connection((self.address, 443), timeout=self.timeout)
        self.sock = self._context.wrap_socket(raw, server_hostname=self.host)


class SourceHTTPError(ValueError):
    def __init__(self, status, retry_after=None):
        super().__init__(f"Source returned HTTP {status}")
        self.status = status
        self.retry_after = retry_after


def retry_after_seconds(value):
    if not value or len(value) > 128:
        return None
    try:
        seconds = (
            int(value)
            if value.isdigit()
            else (
                parsedate_to_datetime(value) - datetime.now(timezone.utc)
            ).total_seconds()
        )
        return max(0, min(604800, seconds))
    except (ValueError, TypeError, OverflowError):
        return None


class SafeFetcher:
    def __init__(self):
        self.robots = {}

    def _raw(self, url, redirects=0, max_bytes=MAX_BYTES):
        if not 1 <= max_bytes <= 8_000_000:
            raise ValueError("Invalid content limit")
        if redirects > 3:
            raise ValueError("Too many redirects")
        host, path, ips = validate_url(url)
        conn = PinnedHTTPSConnection(host, ips[0])
        try:
            conn.request(
                "GET",
                path,
                headers={
                    "Host": host,
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json, application/atom+xml, text/html, text/plain",
                    "Accept-Encoding": "identity",
                },
            )
            response = conn.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ValueError("Redirect without location")
                return self._raw(urljoin(url, location), redirects + 1, max_bytes)
            if response.status != 200:
                raise SourceHTTPError(
                    response.status,
                    retry_after_seconds(response.getheader("Retry-After")),
                )
            if not any(
                t in response.getheader("Content-Type", "").lower()
                for t in ("json", "xml", "html", "text/plain")
            ):
                raise ValueError("Unsupported content type")
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise ValueError("Source exceeds content limit")
            return body, url
        finally:
            conn.close()

    def get(self, url):
        host, _, _ = validate_url(url)
        cached = self.robots.get(host)
        if not cached or time.monotonic() - cached[0] > 3600:
            raw, _ = self._raw(f"https://{host}/robots.txt")
            parser = RobotFileParser()
            parser.parse(raw.decode("utf-8", errors="replace").splitlines())
            if len(self.robots) > 100:
                self.robots.clear()
            self.robots[host] = (time.monotonic(), parser)
        if not self.robots[host][1].can_fetch(USER_AGENT, url):
            raise ValueError("Source robots policy disallows this request")
        return self._raw(url)
