# Canonical data and migrations

Flyway applies the ordered migrations in `backend/src/main/resources/db/migration`. PostgreSQL is used in production, local development, and integration tests; there is no H2 or in-memory application repository.

Core records use UUID primary keys. High-volume event/search tables use sequences. Ownership and evidence use foreign keys. Unique constraints prevent duplicate article slugs, duplicate entity canonical IDs, duplicate aliases on an entity, duplicate evidence mappings, repeated collection membership, and duplicate outbox versions. A partial unique index permits only one nonterminal research job per normalized topic.

Articles use versioned JSONB content:

```json
{"schemaVersion":1,"sections":[{"id":"overview","title":"Overview","claims":["claim-uuid"]}],"attributes":{"Atomic number":{"value":"3","claimId":"claim-uuid"}}}
```

The renderer resolves each statement through claim records. Section and attribute citation IDs must belong to the article. Evidence excerpts and stance live in `claim_evidence`, which points to unique source URLs. Editorial revision updates cannot silently attach claims belonging to another article.

A trigger-maintained weighted `tsvector` (title A, summary B, full claim prose C) has a GIN index. Claim inserts, updates and deletes refresh the owning article index within the same PostgreSQL transaction. JSON citation identifiers are not mistaken for prose.

Research jobs retain JSON checkpoints and event rows. Python's separate SQLite store contains only workflow execution checkpoints; it is not a second application source of truth. Review publication persists selected claims, evidence, citations, source metadata, first revision, review record, audit event, and outbox event in a single PostgreSQL transaction.

Revision restore locks the article, rejects stale expected versions, copies the requested historical JSON into a new revision, updates the content hash, and queues a new index version. Old snapshots remain immutable. All snapshots are currently retained; compressed delta optimization remains open.

Outbox processing uses `FOR UPDATE SKIP LOCKED` plus expiring leases. Per-article expiring projection leases serialize concurrent article versions. Index results are unique by article and destination, and an older result cannot overwrite a newer version. Failed destinations retry with backoff, eventually become dead letters, and create a quality issue. A successful requeue resolves indexing issues. Schema includes reserved tables for future maps, follows, notifications and audit extensions; table existence does not mean the UI feature is complete.
