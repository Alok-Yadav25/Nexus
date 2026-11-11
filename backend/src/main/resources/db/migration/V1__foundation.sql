CREATE TABLE users (
 id uuid PRIMARY KEY, email varchar(254) NOT NULL UNIQUE, password_hash text NOT NULL,
 role varchar(20) NOT NULL CHECK(role IN ('READER','REVIEWER','ADMIN')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE entities (
 id uuid PRIMARY KEY, name varchar(240) NOT NULL, slug varchar(260) NOT NULL UNIQUE,
 ontology varchar(60) NOT NULL, domain varchar(80) NOT NULL, description text NOT NULL,
 canonical_id varchar(100) UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE entity_aliases (id bigserial PRIMARY KEY, entity_id uuid NOT NULL REFERENCES entities(id), alias varchar(240) NOT NULL, normalized varchar(240) NOT NULL, UNIQUE(entity_id, normalized));
CREATE INDEX alias_lookup ON entity_aliases(normalized);
CREATE TABLE articles (
 id uuid PRIMARY KEY, entity_id uuid NOT NULL UNIQUE REFERENCES entities(id), slug varchar(260) NOT NULL UNIQUE,
 title varchar(240) NOT NULL, summary text NOT NULL, content jsonb NOT NULL,
 status varchar(30) NOT NULL CHECK(status IN ('DRAFT','REVIEW_REQUIRED','PUBLISHED','REJECTED')),
 version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 search_document tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english',coalesce(title,'')),'A') || setweight(to_tsvector('english',coalesce(summary,'')),'B') || setweight(to_tsvector('english',content::text),'C')) STORED
);
CREATE INDEX article_fts ON articles USING gin(search_document);
CREATE TABLE sources (
 id uuid PRIMARY KEY, url text NOT NULL UNIQUE CHECK(url ~ '^https://'), title text NOT NULL, publisher text NOT NULL,
 source_type varchar(40) NOT NULL, published_at date, retrieved_at timestamptz NOT NULL DEFAULT now(),
 license text, health varchar(30) NOT NULL DEFAULT 'UNCHECKED', last_checked_at timestamptz
);
CREATE TABLE claims (
 id uuid PRIMARY KEY, article_id uuid NOT NULL REFERENCES articles(id), text text NOT NULL,
 subject text NOT NULL, predicate text NOT NULL, object text NOT NULL,
 status varchar(30) NOT NULL CHECK(status IN ('VERIFIED','PARTIALLY_VERIFIED','DISPUTED','UNVERIFIED','OUTDATED','FICTIONAL_CANON','THEORETICAL_MODEL')),
 rationale text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE claim_evidence (
 id uuid PRIMARY KEY, claim_id uuid NOT NULL REFERENCES claims(id), source_id uuid NOT NULL REFERENCES sources(id),
 excerpt text NOT NULL, stance varchar(20) NOT NULL CHECK(stance IN ('SUPPORTS','CONTRADICTS','CONTEXT')), UNIQUE(claim_id,source_id,stance)
);
CREATE TABLE citations (id uuid PRIMARY KEY, article_id uuid NOT NULL REFERENCES articles(id), claim_id uuid NOT NULL REFERENCES claims(id), section_id varchar(100) NOT NULL, UNIQUE(article_id,claim_id,section_id));
CREATE TABLE relationships (
 id uuid PRIMARY KEY, from_entity uuid NOT NULL REFERENCES entities(id), to_entity uuid NOT NULL REFERENCES entities(id),
 type varchar(40) NOT NULL, claim_id uuid NOT NULL REFERENCES claims(id), status varchar(30) NOT NULL DEFAULT 'VERIFIED',
 UNIQUE(from_entity,to_entity,type), CHECK(from_entity <> to_entity)
);
CREATE INDEX relation_from ON relationships(from_entity); CREATE INDEX relation_to ON relationships(to_entity);
CREATE TABLE timeline_events (id uuid PRIMARY KEY, entity_id uuid NOT NULL REFERENCES entities(id), event_date date NOT NULL, date_precision varchar(10) NOT NULL DEFAULT 'YEAR', title text NOT NULL, description text NOT NULL, claim_id uuid NOT NULL REFERENCES claims(id));
CREATE TABLE article_revisions (
 id uuid PRIMARY KEY, article_id uuid NOT NULL REFERENCES articles(id), number int NOT NULL, parent_id uuid REFERENCES article_revisions(id),
 author_id uuid REFERENCES users(id), summary text NOT NULL, content jsonb NOT NULL, content_hash varchar(64) NOT NULL,
 delta bytea, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(article_id,number)
);
CREATE TABLE research_jobs (
 id uuid PRIMARY KEY, topic varchar(240) NOT NULL, normalized_topic varchar(240) NOT NULL, ontology varchar(60) NOT NULL DEFAULT 'UNCLASSIFIED',
 state varchar(40) NOT NULL DEFAULT 'QUEUED', requested_by uuid NOT NULL REFERENCES users(id),
 checkpoint jsonb NOT NULL DEFAULT '{}', draft jsonb, error text, attempts int NOT NULL DEFAULT 0,
 lease_until timestamptz, article_id uuid REFERENCES articles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_topic ON research_jobs(normalized_topic) WHERE state NOT IN ('FAILED','CANCELLED','PUBLISHED','REJECTED');
CREATE TABLE research_job_events (id bigserial PRIMARY KEY, job_id uuid NOT NULL REFERENCES research_jobs(id), stage varchar(40) NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE review_records (id uuid PRIMARY KEY, job_id uuid REFERENCES research_jobs(id), article_id uuid REFERENCES articles(id), reviewer_id uuid NOT NULL REFERENCES users(id), decision varchar(30) NOT NULL, notes text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE collections (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), name varchar(120) NOT NULL, description text NOT NULL DEFAULT '', public boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE collection_items (collection_id uuid NOT NULL REFERENCES collections(id), article_id uuid NOT NULL REFERENCES articles(id), added_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(collection_id,article_id));
CREATE TABLE saved_articles (user_id uuid NOT NULL REFERENCES users(id), article_id uuid NOT NULL REFERENCES articles(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,article_id));
CREATE TABLE followed_entities (user_id uuid NOT NULL REFERENCES users(id), entity_id uuid NOT NULL REFERENCES entities(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,entity_id));
CREATE TABLE knowledge_maps (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), name varchar(120) NOT NULL, public boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE knowledge_map_nodes (map_id uuid REFERENCES knowledge_maps(id), entity_id uuid REFERENCES entities(id), x real NOT NULL DEFAULT 0, y real NOT NULL DEFAULT 0, PRIMARY KEY(map_id,entity_id));
CREATE TABLE knowledge_map_edges (map_id uuid REFERENCES knowledge_maps(id), relationship_id uuid REFERENCES relationships(id), PRIMARY KEY(map_id,relationship_id));
CREATE TABLE search_logs (id bigserial PRIMARY KEY, query varchar(240) NOT NULL, result_count int NOT NULL, latency_ms bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE quality_issues (id uuid PRIMARY KEY, article_id uuid REFERENCES articles(id), type varchar(50) NOT NULL, severity varchar(20) NOT NULL, detail text NOT NULL, resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX unique_open_quality ON quality_issues(article_id,type) WHERE resolved_at IS NULL;
CREATE TABLE indexing_outbox (id uuid PRIMARY KEY, article_id uuid NOT NULL REFERENCES articles(id), version int NOT NULL, state varchar(20) NOT NULL DEFAULT 'PENDING', attempts int NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(article_id,version));
CREATE TABLE indexing_status (article_id uuid REFERENCES articles(id), destination varchar(20) NOT NULL, version int NOT NULL, state varchar(20) NOT NULL, error text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(article_id,destination));
CREATE TABLE notifications (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_logs (id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id), action varchar(100) NOT NULL, target_id uuid, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
