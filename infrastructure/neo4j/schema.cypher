CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;
CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);
CREATE INDEX entity_domain IF NOT EXISTS FOR (e:Entity) ON (e.domain);
// LINK.type is constrained by the Java ontology allowlist. Each edge carries claimId and status.
