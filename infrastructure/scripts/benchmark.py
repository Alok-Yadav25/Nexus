#!/usr/bin/env python3
"""Measure real local HTTP latency; output includes scope, hardware and warm-up."""

import argparse, json, platform, time, statistics, os
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--base", default="http://127.0.0.1:8080")
p.add_argument("--requests", type=int, default=100)
p.add_argument("--concurrency", type=int, default=4)
p.add_argument("--output", default="docs/benchmark-results.json")
args = p.parse_args()


def fetch(path):
    start = time.perf_counter()
    with urlopen(args.base + path, timeout=30) as response:
        response.read()
    return (time.perf_counter() - start) * 1000


with urlopen(args.base + "/api/v1/stats") as response:
    stats = json.load(response)
results = {}
for name, path in [
    ("autocomplete", "/api/v1/search/suggestions?q=lith"),
    ("search", "/api/v1/search?q=lithium"),
    ("article", "/api/v1/articles/lithium"),
]:
    for _ in range(5):
        fetch(path)
    with ThreadPoolExecutor(args.concurrency) as executor:
        values = sorted(executor.map(lambda _: fetch(path), range(args.requests)))
    results[name] = {
        "p50_ms": round(statistics.median(values), 2),
        "p95_ms": round(values[max(0, int(0.95 * len(values)) - 1)], 2),
        "max_ms": round(max(values), 2),
        "samples": len(values),
    }
report = {
    "measuredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "hardware": {
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "cpuCount": os.cpu_count(),
    },
    "dataset": stats,
    "concurrency": args.concurrency,
    "warmupRequests": 5,
    "cacheState": "warm; actual Redis availability determines prefix cache",
    "scope": "Local HTTP on a tiny starter dataset; not a production capacity claim",
    "results": results,
}
Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(results, indent=2))
