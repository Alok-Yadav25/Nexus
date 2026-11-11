# Graph schema

Neo4j stores `(:Entity {id,name,slug,ontology,domain})` and `[:LINK {id,type,claimId,status}]` projections. `Entity.id` is unique. Stable UUIDs are PostgreSQL identities. A controlled `type` property represents semantic relationship types; the Java allowlist rejects unsupported types before projection. One structural Neo4j edge label makes bounded path traversal consistent across semantic types.

Permitted types: RELATED_TO, PART_OF, DISCOVERED_BY, DEVELOPED_BY, USED_IN, LOCATED_IN, CAUSED_BY, DERIVED_FROM, BASED_ON, BELONGS_TO, INFLUENCES, PRECEDES, SUPPORTS, CONTRADICTS, SIMILAR_TO, COMPARED_WITH.

Relationships retain their claim identifier and evidence state. Path discovery admits only VERIFIED links and can traverse either direction. FICTIONAL_CANON and THEORETICAL_MODEL relationships can be shown in exploration but cannot be used to manufacture a verified real-world path. Explanations hydrate canonical claim text from PostgreSQL.

Current bounds: 150 entities, 1,000 candidate canonical edges, neighbor depth 1–3, path depth 1–6, up to three shortest paths. Neo4j is preferred for path retrieval; empty/unavailable projections fall back to canonical bounded SQL records and report that source explicitly. A missing path means no path in this bounded indexed corpus, not a claim that no conceptual connection could exist.

Degrees and cross-domain distributions are computed from actual records. Community detection, persisted alternate ranking, manual merge, and similarity-based entity resolution are pending. No graph extractor currently commits inferred research relationships without provenance.
