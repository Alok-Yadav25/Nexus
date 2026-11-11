#!/usr/bin/env python3
"""Mutating development smoke: edit an editorial note, then restore its prior snapshot."""

import http.cookiejar
import json
import time
import urllib.request
from pathlib import Path

values = dict(
    line.split("=", 1) for line in Path(".env").read_text().splitlines() if "=" in line
)
base = "http://127.0.0.1:8080/api/v1"
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
)


def request(path, data=None, method=None):
    headers = {}
    if data is not None:
        headers = {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": request("/auth/csrf")["token"],
        }
    with opener.open(
        urllib.request.Request(
            base + path,
            data=None if data is None else json.dumps(data).encode(),
            headers=headers,
            method=method,
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
before = request("/articles/lithium")
content = json.loads(json.dumps(before["content"]))
content["editorialNote"] = (
    "Temporary development smoke-test editorial note; restored immediately."
)
updated = request(
    "/articles/" + before["id"],
    {
        "version": before["version"],
        "content": content,
        "summary": "Development smoke: exercise revision update",
    },
    "PUT",
)
restored = request(
    "/articles/" + before["id"] + "/restore",
    {"number": before["version"], "version": updated["version"]},
)
assert restored["content"] == before["content"]
for _ in range(45):
    article = request("/articles/lithium")
    if len(article["indexing"]) == 3 and all(
        i["state"] == "SUCCESS" and i["version"] == restored["version"]
        for i in article["indexing"]
    ):
        break
    time.sleep(2)
else:
    raise AssertionError(
        "Restored content did not fully reindex within the check window"
    )
revisions = request("/articles/" + before["id"] + "/revisions")
assert len(revisions) >= 3
report = {
    "article": "Lithium",
    "priorVersion": before["version"],
    "editedVersion": updated["version"],
    "restoredAsVersion": restored["version"],
    "priorContentPreserved": True,
    "historyPreserved": True,
    "destinations": article["indexing"],
}
Path("docs/live-restore-result.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
