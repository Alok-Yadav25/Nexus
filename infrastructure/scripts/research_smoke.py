#!/usr/bin/env python3
"""Submit one real private draft, record real stages, stop at mandatory human review."""

import json, urllib.request, http.cookiejar, time, argparse
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--topic", default="Quantum computing")
args = p.parse_args()
values = dict(
    line.split("=", 1) for line in Path(".env").read_text().splitlines() if "=" in line
)
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
)
base = "http://127.0.0.1:8080/api/v1"


def request(path, data=None):
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
job = request("/research", {"topic": args.topic, "ontology": "Technology"})
path = "/research/" + job["id"]
last = ""
for _ in range(90):
    job = request(path)
    if job["state"] != last:
        print(job["state"], flush=True)
        last = job["state"]
    if job["state"] in ["REVIEW_REQUIRED", "FAILED", "CANCELLED"]:
        break
    time.sleep(2)
assert job["state"] == "REVIEW_REQUIRED", job.get("error")
assert not job.get("article_id")
report = {
    "jobId": job["id"],
    "topic": job["topic"],
    "state": job["state"],
    "sourceCount": len(job["checkpoint"].get("sources", [])),
    "claimCount": len(job["checkpoint"].get("claims", [])),
    "stages": [e["stage"] for e in job["events"]],
    "published": False,
}
Path("docs/live-research-result.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
