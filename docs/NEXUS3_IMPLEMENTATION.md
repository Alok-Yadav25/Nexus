# NEXUS 3.0 implementation matrix

Started 10 November 2026. States: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, TESTED, BLOCKED. TESTED requires recorded execution evidence. The existing NEXUS 2 baseline and data are preserved. The public preview remains stopped except for temporary, task-owned verification services.

| Work | State | Evidence / remaining work |
|---|---|---|
| Baseline and architecture | TESTED | Retained Next/Spring/FastAPI stack and data; fresh Java 32, Python 32 and frontend 16 tests pass |
| F01 cookie binding | TESTED | Correct servlet prefix; actual embedded-Tomcat Secure/HttpOnly/SameSite response header test |
| F02 public revision privacy | TESTED | Generic public attribution; regression excludes account emails |
| F03 login verification | TESTED | Valid BCrypt cost-12 dummy hash and same encoder.matches path; UTF-8 password byte limit |
| F04 proxy-aware quotas | TESTED | HMAC accounts, signed browser identities, atomic Redis counters with bounded fallback; spoofed forwarding/tampered identity regression |
| F05 accessible dialogs | TESTED | Native showModal; focus, inert background, trapping/restoration; production desktop/mobile checks passed |
| F06 frontend headers | TESTED | Per-request nonce CSP, frame/MIME/referrer/permissions headers, HTTPS-only HSTS |
| F07 autocomplete semantics | TESTED | Per-instance IDs, active descendant, stale-selection clearing |
| F08 URL filters | TESTED | Domain/sort/query/page derive from URL; preserves unrelated parameters and history |
| F09 saved membership | TESTED | Persisted save/unsave backend and browser reload checks; optimistic rollback |
| F10 collection consistency | TESTED | List/detail/dashboard invalidation on add/remove/create; browser checks passed |
| F11 sign-in return context | TESTED | Safe relative destination; topic/ontology/canonical ID carried through auth; malicious destination unit tests |
| F12 theme coverage | TESTED | Light button contrast and ReactFlow color mode; screenshots reviewed |
| F13 first-paint theme | TESTED | Cookie-based SSR plus nonced prepaint preference resolution, guarded localStorage |
| F14 proper article errors | TESTED | Server-side article load/notFound; upstream failure remains an error, not a missing page |
| F15 SEO | TESTED | Published article metadata, OG image, safe JSON-LD, shard sitemap/index and private-route noindex |
| F16 mobile controls | TESTED | Existing hero composition retained; readable labels and touch controls enlarged |
| F17 persistent navigation | TESTED | Fixed landing header with existing identity and navigation |
| F18 research subscriptions | TESTED | Terminal-state stop, no unconditional polling, five bounded reconnect attempts; APPROVED remains live until indexing publishes |
| F19 graph neighborhoods | TESTED | Indexed entity-centered traversal; 170-entity fixture outside global top-N; bounded six-hop SQL path fallback |
| F20 real element symbols | IMPLEMENTED | Actual cited Symbol metadata or neutral atom glyph |
| Groq provider and structured synthesis | TESTED | Live Groq model discovery and structured inference succeeded with openai/gpt-oss-20b: 3 sections, valid schema/cited IDs, 664 input + 587 output tokens in 2.19 seconds. Running AI service uses Groq. Failure/budget/fallback unit tests also pass |
| Universal source registry and resolution | IN_PROGRESS | Wikidata/Wikipedia/Crossref candidates, canonical IDs and ambiguity handling; no finite subject list. Specialized domain research strategies remain incomplete |
| Universal encyclopedia search / reading / browsing | TESTED | Live Wikipedia results for every query, immediate full-text reader with citations/revision/attribution, 34 observed root subjects and paged subcategories; 28 focused production browser checks plus provider/parser/cache tests passed. See UNIVERSAL_ENCYCLOPEDIA.md |
| Evidence-grounded article composition | IN_PROGRESS | Original quotations, review-only generated sections, accepted claim/section citation mapping. Independent fact checker and deep expansion remain incomplete |
| Planetary viewer | TESTED | Real NASA/JPL physical/orbital records and PDS ring boundaries; adjustable orbit and source-backed body comparison |
| Molecular viewer | TESTED | Real PubChem IDs, atoms, bonds, Å coordinates and conformer distance measurement; rejects incomplete arrays/unknown units |
| Visualization registry / article integration | TESTED | Planet/compound renderer selected by ontology and actual provider data; lazy on-demand 3D, offscreen teardown, 2D fallback |
| Knowledge Journey | TESTED | Verified relationship paths, beginner/intermediate/advanced reading guidance, private saved progress and resume; does not invent prerequisites |
| Evidence / freshness presentation | TESTED | Visible references, recorded contradictions and distinct retrieval/verification/article dates; no invented confidence score |
| Interactive learning | TESTED | Orbital time/distance, measured atom distances, sourced planet comparison and keyboard model controls |
| Account recovery / verification | NOT_STARTED | Single-use hashed tokens and configurable mail transport |
| Editorial workspace / knowledge maps / progress | NOT_STARTED | Existing ownership and review gates preserved |
| Ask NEXUS / atlas / research gaps | NOT_STARTED | Evidence-first answers and honest availability |
| Reliability / deployment / recovery | IN_PROGRESS | 144 local tests and production build pass; Compose configuration validates. Container execution, load/chaos and isolated restore drill remain unverified |

The four prioritized experiences are implemented and passed production browser and visual validation. This matrix does not declare the complete 2,356-line engineering brief finished. Existing hero artwork and composition remain; only the explicitly requested navigation/readability/control repairs affect its presentation. No paid Sketchfab model, generated NASA texture, or unlicensed illustration was imported.

## Current verification artifacts

Local ignored evidence: `.tools/nexus3-java-final.log`, `.tools/nexus3-build.log`, `.tools/nexus3-unit.log`, `.tools/nexus3-browser-final.log`, `.tools/nexus3-browser-followup.log`, `.tools/nexus3-qa/full-run/`, and real provider records `.tools/nexus3-planet.json` / `.tools/nexus3-molecule.json`. Checked-in provider fixture tests preserve the actual recorded source structure. Live Saturn, Earth and water checks succeeded; provider availability later can differ. Live Groq inference succeeded after the user added the local key; sanitized evidence is in `.tools/groq-live-health.json` and `.tools/groq-live-synthesis.json`. No article was published by this probe.

## Remaining scope

Account recovery/email transport, a complete editorial workspace, personal map CRUD/versioning, persisted reading progress/annotations, Ask NEXUS, background freshness re-verification, automatic relationship/media candidates, computer architecture/physics and other subject viewers, cross-replica sessions/provider budgets, large-corpus load and backup-restore drills remain unfinished. Database tables reserved for a future feature are not a functioning feature. Journey selectors currently list the first 150 graph concepts; entity-centered graph lookup itself is not restricted to that list.

The complete production browser suite passed 64 scenarios, followed by six focused reruns after the metadata-base fix. Scientific WebGL pixel changes and offscreen canvas release were verified. Layouts were checked at 320, 360, 390, 768 and 1440 CSS pixels. F20 remains implemented from actual Symbol metadata/neutral fallback; a dedicated non-Lithium rendered-card regression is not yet recorded. Test success is not a complete accessibility or security certification.


## Subsequent product audit — 11 November 2026

The user subsequently requested the full visual refresh, supplied wordmark, version-label removal, footer credit and a product audit. Those authorized changes supersede the earlier hero-preservation note. Device-only Wikipedia reading lists/progress, text sizing and citation copying are now implemented and tested; account-synced annotations and progress remain future work. The latest audit passed 88 production browser checks, 39 Java, 52 Python and 20 frontend unit tests. See `SITE_AUDIT.md` and `TEST_RESULTS.md` for current evidence and the prioritized remaining scope.
