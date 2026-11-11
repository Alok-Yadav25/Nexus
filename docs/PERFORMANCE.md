# Performance

Engineering targets: cached autocomplete p95 <50 ms; indexed search p95 <300 ms; article lookup p95 <200 ms; graph neighbor lookup p95 <300 ms. These are targets, not service guarantees.

Run `python3 infrastructure/scripts/benchmark.py --requests 100 --concurrency 4` against a running stack. The generated JSON records platform/CPU count, corpus counts, warm-up requests, sample counts, and p50/p95/max. Timings measure complete local HTTP requests, including any index provider call. A tiny starter corpus cannot establish production capacity or cold-start behavior.

Autocomplete rebuilds a compressed thread-safe radix trie from actual entity, alias, and search popularity records. Redis stores 30-second prefix responses; a new trie generation changes cache keys, and approved publication rebuilds after commit. Full-text search uses a weighted PostgreSQL GIN index. Exact/alias and dense results combine with reciprocal rank fusion k=60 (configurable with SEARCH_RRF_K). VECTOR_MIN_SCORE defaults to 0.55 as a retrieval relevance heuristic, not a truth score; tune it against a representative evaluation set. Qdrant availability is checked before embedding so unavailable vector infrastructure does not trigger unnecessary model loading.

Graphs are bounded; 3D is explicitly selected, dynamically imported, rendered on demand, and suspended off-screen. Reduced-motion users receive no continuous animation. Article pages server-render canonical content. Frontend lists paginate. PostgreSQL locks and leases prevent duplicate active jobs; outbox destinations retain independent version/error state.

Production work remaining: representative large datasets, distributed cache/rate-limit benchmarks, contention/chaos testing, load shedding, slow-query analysis, structured tracing dashboards, and reconciliation under multiple worker instances.
