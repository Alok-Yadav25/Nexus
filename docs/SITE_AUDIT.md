# NEXUS site audit and improvements

11 November 2026. Scope: source review, local production services, existing browser regressions and new user-flow tests. This is a practical product/reliability audit, not a production load test or a complete accessibility/security certification. The current visual direction, supplied wordmark and Alok Yadav footer credit are retained.

## Verified issues fixed

| Issue | User impact | Implemented change |
|---|---|---|
| Results pages opened with an empty search field | Users could not easily edit the current search; Back/Forward did not restore the field | Search input follows its URL query, trims submissions, clears stale selection and has a clear button |
| Browser requests had no deadline/cancellation | Abandoned searches could keep running client requests; stalled requests could remain pending | A 65-second overall deadline includes CSRF setup; query cancellation reaches fetch; 4xx errors including 404 are not automatically retried |
| Successful source retrieval depended on cache persistence | A failed cache read/write could hide a valid live result behind a misleading unavailable error | Cache reads and writes are best-effort; validated live responses are returned independently |
| One provider lock caused unbounded waiting across unrelated providers | Concurrent cold requests could queue beyond the Java request timeout | Lock acquisition is bounded at five seconds; Wikipedia/Wikidata/Commons retain one shared policy bucket, separate from Crossref |
| Provider retry instructions were discarded | Requests could repeat during a provider's requested cooldown | HTTP 429/503 Retry-After seconds/date values are retained and applied as shared bucket cooldowns; callers fail promptly while cooling down |
| Query-bearing Wikipedia links lost revision/action parameters | A source revision link could silently open today's article | Query-bearing links remain external links to their actual Wikipedia revision/action URL |
| Very large article truncation left dead contents links | A heading could be listed after its content was removed by the node budget | Contents are filtered against IDs actually retained in the safe article tree |
| Closed mobile navigation remained keyboard-accessible | Focus could reach offscreen controls; open navigation did not isolate the page | Closed navigation is hidden/inert; the open drawer isolates background controls, traps focus, supports Escape and restores focus |
| Tall navigation could put controls beyond the viewport | Adding useful navigation made the bottom controls harder to reach | The sidebar scrolls independently; clicking the current page also closes the drawer |
| No skip navigation | Keyboard users had to traverse repeated navigation | A visible-on-focus Skip to content link targets the main landmark |
| Hover tilt could vanish after page scrolling | A stationary pointer lost its hover treatment when layout or scroll position changed | Pointer bounds are refreshed on scroll/resize while preserving a valid hovered card |
| Search URLs were eligible for indexing | Arbitrary search query pages could appear in search engines | Search and the new local reading list use noindex metadata; reviewed public article SEO is preserved |

Implementation: `frontend/components/search.tsx`, `shell.tsx`, `providers.tsx`, `ui.tsx`, `frontend/lib/api.ts`, route metadata, `backend/.../learning/EncyclopediaController.java`, `ai-service/app/sources.py`, `security.py` and `encyclopedia.py`.

## Added reader features

- **Save for later:** explicit saving of Wikipedia article identity, title, source revision and timestamp, up to 100 entries.
- **Reading list:** a dedicated `/reading-list` workspace and navigation entry, with removal and start/resume controls.
- **Reading progress and resume:** progress and source section are kept for saved articles, with visible progress indicators. Unsaved browsing is not added to a history list.
- **Adjustable article text:** 14–22 px with a saved preference.
- **Copy source citation:** includes Wikipedia contributors, article title, source revision/permalink and retrieval date. If clipboard access is unavailable, a selectable text field is shown.
- **Honest persistence:** saved items and preferences stay in this browser; the interface states this and handles blocked storage without claiming a successful save. Articles still require an internet connection to reopen. This does not imply offline copies or cloud synchronization.

Reader features live in `frontend/components/reading-workspace.tsx` and `frontend/lib/reading-list.ts`. Wikipedia source articles remain distinct from NEXUS-reviewed claims. No fetched or generated article is automatically published into the canonical evidence graph.

## Remaining product gaps and recommended order

1. **Account recovery before a public launch.** Add actual password-reset and email-verification flows with single-use tokens and configured mail delivery. Existing reserved database tables are not a functioning recovery service.
2. **Backups and production observability.** Verify restore procedures, alerting, provider errors, slow queries and capacity under realistic load. Current local tests do not establish production scale. Provider budgets/cooldowns are currently per process; coordinate them across replicas before scaling out.
3. **Cloud-synced reading and notes.** Associate external article identities, bookmarks, progress and annotations with authenticated accounts while retaining an explicit guest/device-only mode. The new local reading list does not sync across devices.
4. **Evidence-grounded Ask NEXUS.** Answer questions from selected documents and show the exact supporting passages and sources. Keep uncertainty and conflicting evidence visible. Avoid treating fluent AI output as verification.
5. **Richer real article visuals.** Add licensed illustrations, captions, attribution and useful subject-specific viewers. The current Wikipedia reader intentionally omits images whose separate license/credit data was not imported. The official [Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo) provides media metadata for a proper implementation.
6. **Multilingual discovery.** English coverage is broad, but the current external reader/search is English-only. Prioritize Hindi and other languages relevant to visitors; use actual counterpart articles rather than inventing translations. [MediaWiki language links](https://www.mediawiki.org/wiki/API:Langlinks) identify existing language editions.
7. **Expand the graph through reviewable data.** Universal search covers Wikipedia; the evidenced NEXUS graph and journeys still use the much smaller reviewed collection. Import entity/relationship candidates with provenance and review states rather than presenting every external relationship as verified.
8. **Advanced research workflow.** Add selected-source comparison, a research notebook, exportable citations, review queues and freshness subscriptions. These are more useful next differentiators than additional decorative animation.

Focus isolation follows the behavior described in the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). A complete accessibility pass should still include assistive technology, contrast, zoom and touch testing beyond the automated cases.

## Verification evidence

Logs are retained locally in `.tools/audit-build.log`, `.tools/audit-java-full.log`, `.tools/audit-python-tests.log`, `.tools/audit-frontend-unit.log` and `.tools/audit-browser-full.log`. Browser tests exercise search history/clearing, no retry on missing articles, saved reading and resume, text preferences, denied clipboard/storage, skip navigation and mobile focus/background isolation. Final counts and any follow-up checks are recorded in `TEST_RESULTS.md`.

Final result: **88/88 production browser checks passed** on desktop/mobile in light and dark themes, including the new saved-reader and keyboard flows. **39 Java, 52 Python and 20 frontend unit tests passed**, as did the optimized production build. An initial full browser run caught a hover/scroll interaction; it was corrected and the full suite passed on rerun. The final browser log is `.tools/audit-browser-final.log`, with reviewed screenshots in `.tools/audit-qa-final/`.

Two final desktop/mobile reader visual checks also passed after waiting for entrance motion to settle before capturing screenshots (`.tools/audit-reader-visual.log`). Backend `/actuator/health` returned UP; the local preview and reading-list routes returned 200.
