# Verification report

Executed locally on **10 November 2026** (Asia/Kolkata). No external CI or public deployment is claimed.

| Check | Result |
|---|---|
| Java `mvn verify` | **32 passed**, 0 failures/errors/skipped; executable Spring Boot JAR built |
| Python `pytest` | **32 passed** |
| Frontend Vitest/React Testing Library | **16 passed** |
| Playwright against real Java/PostgreSQL | **64 passed**: 32 desktop and 32 mobile scenarios against the standalone production frontend |
| Strict TypeScript and Next.js production build | Passed |
| Development and production Compose configuration | Both validate with Docker Compose 2.40.3 |
| Container runtime/CI execution | Not executed; no Docker daemon installed |

The 144 automated tests cover the baseline algorithms, API persistence, source integrity, CSRF/roles/ownership, indexing, revisions, search, collections and motion. New coverage includes actual Secure/HttpOnly/SameSite cookie headers, valid BCrypt dummy verification, signed anonymous quota identities, public revision privacy, entity-centered graph lookup beyond 150 nodes, canonical identity separation, human acceptance of generated sections, correct section citations and preservation of real source retrieval dates.

Browser regressions cover native modal focus/inert behavior, unique autocomplete IDs, URL history, authentication return context, saved-state reloads, cached collection counts, blocked localStorage, true article 404/SEO, terminal research networking and saved journey resume. Scientific checks use actual PubChem water and NASA/JPL Saturn/Earth records: atom distances, WebGL-free projection, WebGL zoom pixel changes, offscreen canvas teardown/recreation, orbital time and planet comparison. Viewport checks cover 320, 360, 390, 768 and 1440 CSS pixels. Browser guards found no page errors, hydration mismatches or CSP execution failures in the new flows.

After the final metadata-base fix, six focused desktop/mobile SEO and scientific-rendering scenarios passed again. Both the final production build and Compose configurations pass. The broader brief remains incomplete; see the [NEXUS 3.0 implementation matrix](NEXUS3_IMPLEMENTATION.md).

## Real services and live checks

Native processes: PostgreSQL via the Java development launcher, Redis 8.10.2 core, Neo4j Community 5.26.24 on a project-local Java 21 runtime, Qdrant 1.16.3, FastAPI, and Next.js. Host: macOS 27.2 ARM64, 8 reported CPUs. Java compilation used the installed Java 22 with release target 21. Node 22.22.0 ARM64 and Python 3.12 were used. Container Java target is 21.

- `/actuator/health` reported UP with the actual configured graph driver and Redis connection.
- FastEmbed produced real `BAAI/bge-small-en-v1.5` output with **384 dimensions**. Qdrant was created from runtime dimensions and stored actual section vectors.
- Lithium reached successful **NEO4J, QDRANT and LEXICAL** destination states. Real search reported semantic availability and combined exact/lexical/dense rankings. A two-hop path came from **Neo4j**, not a fabricated response.
- A live “Quantum computing” research job collected **3 permitted sources**, extracted **3 source-linked claims**, emitted actual workflow stages, and stopped at **REVIEW_REQUIRED**. Claims remained UNVERIFIED; no automated human approval or publication occurred. See [live research result](live-research-result.json).
- An authorized development smoke test edited only an editorial note, then restored the previous content. It created versions **1 → 2 → 3**, retained prior history, restored the original content, and brought all three index destinations to successful version 3. See [live restore result](live-restore-result.json).
- The single-command `dev.sh --full` path was started successfully, passed the native smoke checks, and cleanly stopped its owned services.
- A clean backend/PostgreSQL stop and restart retained the review-required job, three source records in its checkpoint, article version 3, and revision history. See [persistence result](persistence-result.json).

## Measured local latency

These measurements precede the NEXUS 3.0 changes; the new provider/viewer paths have not been rebenchmarked.

50 requests per operation, concurrency 4, five warm-ups, actual warm Redis and loaded embedding model, eight published starter articles / eight entities / fifteen claims / six sources / five relationships. Browser/test activity was also present on the same machine. These observations do not establish production capacity.

| Operation | p50 | p95 |
|---|---:|---:|
| Cached autocomplete | 7.26 ms | 23.15 ms |
| Hybrid search | 48.46 ms | 84.92 ms |
| Article API | 12.68 ms | 21.54 ms |

Machine-readable scope and measurements: [benchmark results](benchmark-results.json). Graph latency and cold/model-download performance were not benchmarked.

## Verification limits

The connected interactive browser host was unavailable. Isolated automated Chrome desktop/mobile tests ran successfully. Hero and content-section screenshots at desktop and mobile sizes were visually reviewed, including both content color themes; carousel controls and the non-WebGL fallback were tested. The scientific viewers were visually reviewed in 2D and 3D; direct manipulation of the separate 3D knowledge graph remains untested. A subsequent live Groq probe passed with openai/gpt-oss-20b: authenticated model discovery, valid structured synthesis of three existing article claims into three cited sections, 664 prompt / 587 completion tokens, 2.19 seconds. The running AI service also reported Groq available. This was a provider test and did not publish an article. The actual Docker images, external GitHub Actions job, public hosting, independent fact-checking accuracy, third-party source availability over time, large-corpus performance, multi-replica chaos recovery, and backup restore drills remain unverified.

See [implementation status](IMPLEMENTATION_STATUS.md) for feature gaps. Passing tests do not imply the entire master specification is complete or that every retrieved claim is true.


## Universal encyclopedia search — 11 November 2026

Live Wikipedia search, immediate full-text reading and category browsing passed 28 focused production browser scenarios on desktop/mobile, including both themes and the retained hero. Python 49 tests, the existing Java 32 plus five new proxy/cache tests, frontend 16 tests and the production build passed. An earlier broader development run had four failures; all four passed after updating the intended library wording and rerunning the mobile flows against production. See [universal encyclopedia implementation and evidence](UNIVERSAL_ENCYCLOPEDIA.md).


## Visual refresh — 11 November 2026

The editorial redesign, Manrope/Geist typography and shared hero/page dark theme pass the full production Chrome suite: **80/80 desktop/mobile browser scenarios**, plus **16 frontend unit tests**, TypeScript checking and the optimized production build. The suite exercises both themes, actual Wikipedia results/readers, evidence, account/collection flows, scientific models, hero controls, reduced motion, narrow/tablet layouts and prompt card transitions. Screenshots of the homepage, learning section, search and reader were reviewed. Evidence: `.tools/premium-build.log`, `.tools/premium-browser-production.log` and `.tools/premium-qa-production/`. See [design decisions and motion changes](UI_DESIGN.md). The native visible-browser handoff hit an OS capture failure; browser QA used the automated Chrome suite.


## Product audit and reading features — 11 November 2026

Fixed search state, cancellation/timeouts, 4xx retry handling, source cache failure isolation, bounded provider queues/cooldowns, revision links, truncated contents, sidebar reachability/focus and a hover/scroll defect. Added device-only save-for-later, reading progress/resume, text preferences and source citation copying with blocked clipboard/storage handling. Final verification: **88/88 production browser scenarios**, **39 Java**, **52 Python**, **20 frontend unit tests**, and the production build passed. See [findings, fixes and prioritized recommendations](SITE_AUDIT.md). Current logs: `.tools/audit-browser-final.log`, `.tools/audit-java-full.log`, `.tools/audit-python-tests.log`, `.tools/audit-frontend-unit.log` and `.tools/audit-build.log`.

## Repository publication checks — 11 November 2026

Fresh checks passed: **39 Java tests**, **52 Python tests**, **21 frontend unit tests**, and the production build. The additional frontend regression reproduces a shared-query-cache race between a hydrated shell and a streamed page; the initial pending snapshot now remains consistent until that consumer hydrates.

The first release browser run caught that intermittent hydration error. After its fix, a full production run passed **87 scenarios** and had one live Wikipedia loading assertion expire at five seconds. That assertion now allows the real provider deadline; its targeted rerun passed. All **88 desktop/mobile scenarios** were therefore validated across the full run and the focused rerun. These are distinct runs, not an asserted clean 88/88 release run. Logs are local ignored evidence: `.tools/release-java.log`, `.tools/release-python.log`, `.tools/release-frontend-unit.log`, `.tools/release-build.log`, `.tools/release-browser-fixed.log` and `.tools/release-browser-retest.log`.

README screenshots were visually checked, local credentials were scanned out of staged content, and all four scientific fixtures are included. Native application verification is separate from the GitHub Actions cold Compose job; no local Docker runtime or public deployment is claimed.

### First GitHub Actions run

Commit `6192928` passed the Java, Python and frontend jobs on Linux. The full Docker Compose stack built and reached healthy status. Browser tests did **not** execute in that run: `playwright install --with-deps` failed because the runner could not resolve Ubuntu package mirrors while installing optional system fonts. CI now selects the runner's preinstalled Google Chrome through the same `PLAYWRIGHT_CHROME_PATH` mechanism used locally, avoiding that redundant package-install step. The browser scenarios and assertions remain enabled.

### Linux provider transport regression

The next container run executed all browser scenarios: **80 passed, 8 failed**. Six failures came from unavailable molecular data; a direct Linux provider diagnostic exposed `OSError: [Errno 101] Network is unreachable`. The fetcher selected only the first text-sorted DNS address, allowing an unreachable IPv6 route to mask valid IPv4 records. It now prefers IPv4, tries only previously validated addresses within one connection deadline, retains hostname verification, and immediately rejects certificate verification failures. Five new regressions cover ordering, mixed private DNS answers, fallback, complete failure, certificate rejection and the shared deadline. **57 Python tests pass**, and a fresh real PubChem fetch returned CID 962 with three atoms and two bonds.

The two hero checks exceeded a 950 ms wall-clock assertion on the shared runner. They now separately enforce the unchanged **560 ms maximum configured transition duration** and allow up to three seconds for the runner to present frames and report completion. Both focused local desktop/mobile checks pass. No hero styling or animation duration was extended.

### Provider fix confirmed on Linux

Commit `64b1e2d` passed Java, Python and frontend CI jobs. The Linux live probe now returned **PubChem CID 962, three atoms**. Its full Compose browser run passed **87/88**, including all molecular retrieval, 3D/2D measurements and responsive science scenarios. Only the desktop hero check remained: the trace showed the card at its destination by approximately one second, while `getAnimations()` still reported a running transition. That check now compares the actual rendered box with the unanimated destination, after fonts settle, and retains the 560 ms configured-duration budget. Six focused local desktop/mobile repeats passed with the geometry assertion.
