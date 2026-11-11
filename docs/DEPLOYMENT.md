# Deployment and recovery

## Complete zero-mandatory-payment path

Use Docker Compose on hardware you control. The full application needs persistent JVM and Python processes plus four stateful services; it is not a static frontend or a single Worker. Start with roughly 8 GB available RAM, then measure your workload. Small embedding inference runs on CPU and downloads model files on first use. No hosted service or paid inference provider is enabled automatically.

```sh
python3 infrastructure/scripts/init_env.py
docker compose config --quiet
docker compose up --build --wait --wait-timeout 600
```

The frontend waits for backend health; backend waits for PostgreSQL, Redis, Neo4j and AI readiness. Qdrant exposes a TCP health probe. Data uses named volumes. The AI checkpoint/model volume must be writable by UID 10001. If a container runtime initializes that volume with different permissions, correct volume ownership before startup; do not run the AI service as root.

Use a TLS reverse proxy in front of the frontend and keep Java and database ports private. Configure COOKIE_SECURE=true and FRONTEND_ORIGIN. Disable public OpenAPI with `SPRINGDOC_API_DOCS_ENABLED=false` and `SPRINGDOC_SWAGGER_UI_ENABLED=false` where documentation is not intended to be public. Do not use the local development launcher for public hosting. Its optional retained storage is for development, while Compose supplies the deployment volumes and health orchestration.

Set SITE_URL to the canonical public HTTPS origin for article metadata and sitemap URLs. The production Compose override enables HTTPS_DEPLOYMENT=true for HSTS. GROQ_API_KEY, model and budgets are passed only to the Python service; never use NEXT_PUBLIC variables for credentials. Its request-budget database persists in the AI data volume. An absent key leaves the extractive fallback available. Configure NEXUS_RESEARCH_CONTACT with a genuine operator contact for public source APIs. Multi-replica session storage and a global hosted-inference budget remain unfinished.

## Optional hosted services

Verified against official provider documentation on 10 November 2026; quotas and eligibility can change. No cloud accounts, upgrades or resources were created.

| Service | Free option and constraints | Reference |
|---|---|---|
| Vercel | Hobby is for personal, noncommercial use; Next.js frontend only. JVM, workers and databases still need hosting. Cold starts and plan resource limits apply. | https://vercel.com/docs/plans/hobby |
| Supabase | Free PostgreSQL currently lists 500 MB database size per project; egress, project count, inactivity and connection limits also apply. Use JDBC/TLS and run Flyway before starting Java. | https://supabase.com/docs/guides/platform/billing-on-supabase |
| Neo4j AuraDB | Free graph offering lists 50,000 nodes and 175,000 relationships. Check current regional availability and suspension/retention policy before choosing it. Driver supports secure neo4j+s URIs. | https://neo4j.com/free-graph-database/ |
| Qdrant Cloud | Single node, 0.5 vCPU, 1 GB RAM, 4 GB disk. Official creation guide describes suspension after one unused week and deletion after four inactive weeks unless reactivated. Requires API-key adapter configuration before hosted use. | https://qdrant.tech/pricing/ and https://qdrant.tech/documentation/cloud/create-cluster/ |
| Oracle Always Free | Consider only when your account, region, resource capacity and current terms permit sufficient compute. No capacity, perpetual availability or SLA is assumed; no paid VM fallback is automatic. Self-hosting is the supported alternative. | https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm |

A hosted split requires secure Java↔AI communication, persistent job checkpoints, encrypted database credentials, Qdrant API-key support, and stable frontend proxy routing. Do not publish a frontend pointing at localhost as if the full application were deployed.

## Backups

Back up PostgreSQL before any migration and on a regular schedule. The backup may contain private user and research data. Store it with restricted access, encryption and a defined retention policy.

```sh
mkdir -p backups
chmod 700 backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d nexus -Fc' > backups/nexus.dump
chmod 600 backups/nexus.dump
```

For a consistent full-system snapshot, stop backend/AI workers, back up PostgreSQL, and copy the AI checkpoint volume with SQLite closed. Neo4j and Qdrant can be recreated from canonical published articles; retaining their native backups speeds recovery. Redis caches are rebuildable.

Restore into an empty, isolated database first:

```sh
docker compose stop backend ai
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d nexus --clean --if-exists' < backups/nexus.dump
docker compose start ai backend
```

`--clean` replaces restored objects; run it only against the intended recovery database. Requeue dead projection events through the quality UI. Confirm canonical counts, sample claim/source links, revision hashes, and successful graph/vector versions before switching traffic. Actual backup restore drills and container startup remain release gates until executed.

## CI

GitHub Actions runs Java integration tests against real embedded PostgreSQL, Python checkpoint/security tests, frontend tests/build, and a full Compose desktop/mobile browser job on Linux. Workflow definitions do not imply an external CI run has occurred. Repository publication and CI execution are tracked separately from hosting. Pushing this repository does not deploy a public application.

## Prepared native development runtime

On this workspace, `./infrastructure/scripts/dev.sh --full` can start the application, a retained PostgreSQL directory, and the downloaded native index tools. It reuses already-running index ports and stops only the processes it starts. Admin credentials remain in `.env`; the development PostgreSQL launcher is restricted to local development and is not a hardened public database deployment.

For temporary local production validation, first build the frontend, then run `NEXUS_FRONTEND_MODE=production ./infrastructure/scripts/dev.sh --full`. This copies static/public assets into Next's standalone output and uses its actual server entry point on loopback. Stop the launcher to tear down its owned services. This mode does not publish or open a user-facing preview.

The optional `.tools` downloads are ignored, not committed or required by Docker. They were obtained from official sources: [Qdrant release 1.16.3](https://github.com/qdrant/qdrant/releases/tag/v1.16.3), [Neo4j distributions](https://dist.neo4j.org/), [Eclipse Temurin](https://adoptium.net/), [Redis source](https://download.redis.io/), [Node.js 22.22.0](https://nodejs.org/dist/v22.22.0/), and [Apache Maven Central](https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/). Redis core was built without optional modules; no module build success is claimed. The application uses only core Redis operations.

A retained native database is selected by NEXUS_DEV_DATA_DIR; `dev.sh` defaults to the ignored `data/dev-postgres` directory. Directly invoking LocalApplication without that variable still uses a temporary database. Native graph/vector data lives under `.tools` and can be rebuilt from canonical PostgreSQL records.
