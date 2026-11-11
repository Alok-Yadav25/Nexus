#!/usr/bin/env python3
"""Read-only checks against real services; credentials stay in memory."""

import json, urllib.request, http.cookiejar
from pathlib import Path

base = "http://127.0.0.1:8080/api/v1"
values = dict(
    line.split("=", 1) for line in Path(".env").read_text().splitlines() if "=" in line
)
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
)


def request(path, data=None):
    headers = {}
    if data is not None:
        token = request("/auth/csrf")["token"]
        headers = {"Content-Type": "application/json", "X-CSRF-TOKEN": token}
    with opener.open(
        urllib.request.Request(
            base + path,
            data=None if data is None else json.dumps(data).encode(),
            headers=headers,
        ),
        timeout=30,
    ) as response:
        return json.load(response)


request(
    "/auth/login",
    {
        "email": values["BOOTSTRAP_ADMIN_EMAIL"],
        "password": values["BOOTSTRAP_ADMIN_PASSWORD"],
    },
)
article = request("/articles/lithium")
metrics = request("/admin/analytics")
print(
    "Index results:",
    [
        {k: i[k] for k in ["destination", "version", "state"]}
        for i in article["indexing"]
    ],
)
assert len(article["indexing"]) == 3 and all(
    i["state"] == "SUCCESS" for i in article["indexing"]
)
search = request("/search?q=lithium")
assert search["vectorStatus"] == "AVAILABLE"
assert any("Semantic similarity" in item["reasons"] for item in search["items"])
path = request(
    "/graph/path?from="
    + request("/articles/alkali-metals")["entity_id"]
    + "&to="
    + request("/articles/lithium-ion-batteries")["entity_id"]
)
assert path["source"] == "NEO4J"
assert path["paths"][0]["length"] == 2
print("Real hybrid search: AVAILABLE. Neo4j verified path: 2 hops.")
print(
    "Canonical counts:",
    {k: metrics[k] for k in ["articles", "entities", "relationships"]},
)
print("Read-only full-stack smoke passed.")
