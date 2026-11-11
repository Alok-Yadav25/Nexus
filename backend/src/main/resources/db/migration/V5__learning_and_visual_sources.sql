ALTER TABLE claims ADD COLUMN last_verified_at timestamptz;
CREATE TABLE external_records (
 id uuid PRIMARY KEY, provider varchar(80) NOT NULL, external_id varchar(240) NOT NULL,
 kind varchar(40) NOT NULL, payload jsonb NOT NULL, retrieved_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, UNIQUE(provider,external_id,kind)
);
CREATE TABLE learning_journeys (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), title varchar(240) NOT NULL,
 level varchar(20) NOT NULL CHECK(level IN ('BEGINNER','INTERMEDIATE','ADVANCED')),
 nodes jsonb NOT NULL, completed jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journey_owner ON learning_journeys(user_id,updated_at DESC);
CREATE TABLE reading_progress (
 user_id uuid NOT NULL REFERENCES users(id), article_id uuid NOT NULL REFERENCES articles(id),
 progress double precision NOT NULL CHECK(progress BETWEEN 0 AND 1), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,article_id)
);
CREATE TABLE account_tokens (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), purpose varchar(20) NOT NULL,
 token_hash varchar(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE knowledge_maps ADD COLUMN version int NOT NULL DEFAULT 1;
ALTER TABLE knowledge_maps ADD COLUMN notes text NOT NULL DEFAULT '';
