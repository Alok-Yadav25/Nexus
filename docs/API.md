# API

Base: `/api/v1`. OpenAPI JSON: `/v3/api-docs`; interactive documentation: `/swagger-ui/index.html` on the Java service. The Next.js rewrite proxies `/api/*` to Java so browser sessions remain same-origin.

GET `/auth/csrf` initializes a session and returns `{token}`. Send it as `X-CSRF-TOKEN` on every mutation, including register/login and comparison. Credentials are cookie based and HTTP-only. GET `/auth/me` reports authentication and role. POST `/auth/register`, `/auth/login` accept email and a password of at least 12 characters and at most 72 UTF-8 bytes. POST `/auth/logout` clears the session.

| Route | Behavior | Permission |
|---|---|---|
| GET `/articles?page=0&size=24&domain=&sort=recent&q=` | Published cards, total, bounded pagination; recent or title ordering | Public |
| GET `/articles/{slug}` | Structured content, claims, sources, citations and actual index states | Public |
| PUT `/articles/{id}` | `{version,content,summary}`; optimistic concurrency and new revision | Reviewer/admin |
| GET `/articles/{id}/sources`, `/citations`, `/related` | Source-backed related records | Public |
| GET `/evidence/{claimId}` | Claim, rationale, supporting/conflicting excerpts and source metadata | Public published claims |
| GET `/evidence/{claimId}/sources` | Sources for a published claim | Public |
| GET `/search?q=` | Exact/alias + PostgreSQL full-text + available Qdrant, RRF, explanations, latency and vector availability | Public |
| GET `/search/suggestions?q=` | Compressed radix trie with Redis TTL cache | Public |
| GET `/search/trending` | Actual query counts from the last seven days | Public |
| GET `/encyclopedia/search?q=&offset=0` | Live subject-independent English Wikipedia search; provider descriptions and `nextOffset` continuation, 12 results per page | Public |
| GET `/encyclopedia/article?title=` | Latest Wikipedia full article as a safe document tree, section directory, reference anchors, source revision, retrieval time and attribution/license | Public |
| GET `/encyclopedia/topics?category=Main%20topic%20classifications&cursor=` | Live Wikipedia category directory; articles/subcategories and opaque `nextCursor` continuation | Public |
| GET `/stats` | Actual canonical counts and domains | Public |
| GET `/graph/explore?limit=100` | Bounded canonical graph, maximum 150 nodes | Public |
| GET `/graph/entity/{id}?depth=1`, `/neighbors` | Bounded neighborhood, maximum depth 3 | Public |
| GET `/graph/path?from={id}&to={id}&depth=6` | Up to three shortest VERIFIED paths; Neo4j then explicitly labeled canonical fallback | Public |
| GET `/graph/domains` | Actual domain counts | Public |
| GET `/discover/trending`, `/cross-domain`, `/random` | Real records and evidenced connections | Public |
| POST `/compare` | `{entities:[uuid,uuid],dimensions?:[]}`; 2–4 entries and documented attribute union | Public + CSRF |
| GET `/timeline/{entityId}` | Ordered dated events and their claims; explicit date precision | Public |
| POST `/research` | `{topic,ontology,canonicalId?}`; identity-aware active-job uniqueness; optional wikidata:Q… / enwiki:… identifier | Authenticated |
| GET `/research`, `/{id}`, `/{id}/sources`, `/{id}/claims` | Owned jobs; reviewers may inspect for review | Owner/reviewer/admin |
| GET `/research/{id}/stream` | SSE `stage` events; Last-Event-ID replay; heartbeat; reconnect after 50 seconds | Owner/reviewer/admin |
| POST `/research/{id}/retry`, `/cancel` | Preserve checkpoints and emit actual events | Owner/reviewer/admin |
| POST `/research/{id}/approve` | `{notes,ontology,domain,claims:[{claimId,status,rationale}],acceptGeneratedText?}`; generated sections require explicit acceptance and selected claims | Reviewer/admin |
| POST `/research/{id}/reject` | `{notes}`; retain rejected draft | Reviewer/admin |
| GET `/articles/{id}/revisions` | Ordered immutable snapshots | Public published articles |
| GET `/articles/{id}/compare?from=1&to=2` | Snapshots and Myers edit script | Public |
| POST `/articles/{id}/restore` | `{number,version}`; creates a new revision and outbox event | Reviewer/admin |
| GET/POST `/collections` | List/create private reading collections | Authenticated |
| GET `/collections/{id}` | Collection with published article cards | Owner or signed-in public reader |
| POST `/collections/{id}/items` | `{articleId}`; idempotent add | Owner |
| DELETE `/collections/{id}/items/{articleId}` | Remove from collection | Owner |
| POST/DELETE `/articles/{id}/save` | Save/unsave | Authenticated |
| GET `/articles/{id}/saved` | Current user's persisted membership | Authenticated |
| GET `/entities/resolve?q=` | Distinct external identity/publication candidates with provider IDs, provenance and availability warnings | Public |
| GET `/visuals/planet?q=` | NASA/JPL physical/orbital measurements and available PDS ring radii; exact body name/SPK ID | Public |
| GET `/visuals/molecule?q=` | PubChem actual conformer atoms/bonds/coordinates and units; compound name or CID | Public |
| GET/POST `/journeys` | Owned saved verified relationship routes; create `{from,to,level}` | Authenticated |
| GET `/journeys/{id}` | Private saved route and explored concept IDs | Owner |
| POST `/journeys/{id}/progress` | `{entity,complete}`; validates membership in owned route | Owner |
| GET `/sitemap/articles?page=0` | Published-only canonical article metadata; 1,000-row shards | Public |
| GET `/dashboard` | Saved cards, own collections and jobs | Authenticated |
| GET `/admin/analytics`, `/reviews`, `/quality`, `/health` | Actual records, index and search metrics | Reviewer/admin |
| POST `/admin/quality/scan`, `/{id}/recheck` | Scan local invariants and recheck/requeue issue | Reviewer/admin |
| POST `/admin/sources/{id}/check` | Safe research fetch and affected-claim issue creation | Reviewer/admin |

Errors use HTTP status and an `error` message. Validation is 400, authentication 401, authorization/CSRF 403, absent records 404, concurrency/duplicates 409, unavailable evidenced journeys 422, request quotas 429, and unavailable scientific providers 503. Search limit is 240 characters; page sizes are bounded. Scientific records cache for one day; explicitly labeled stale fallback retains the original retrieval timestamp. No SQL identifiers or Cypher fragments are interpolated from user input.

Direct article creation occurs through the transactional review publication path; an unrestricted POST article endpoint is intentionally not present. Persisted comparison IDs, entity merges, and map editing APIs are not implemented yet.

The main `/search` workspace queries both `/encyclopedia/search` and the NEXUS library `/search` API for every submitted query, including when a reviewed article matches. `/explore` begins with the live Wikipedia directory and retains the NEXUS library filters below. `/read/wikipedia?title=` reads provider content immediately without requiring an account, Groq, or research publication. Provider articles are labeled separately from NEXUS-reviewed claims and never enter the canonical graph automatically.

Encyclopedia query/title inputs accept 1–240 characters; the local library search requires at least two. Wikipedia responses are cached in `external_records` for one hour. An unavailable provider may serve an explicitly labeled saved copy with the original retrieval timestamp; an actual missing article returns 404. The provider uses fixed official HTTPS endpoints, shared conservative request pacing, bounded responses, and cursor validation. Article HTML is converted to an allowlisted tree and rendered as React elements; scripts, event handlers, embeds, executable links and separately licensed images are excluded. Text attribution, revision/history links and the provider license remain visible. The English Wikipedia corpus is broad; this is not a complete index of every webpage on the internet.
