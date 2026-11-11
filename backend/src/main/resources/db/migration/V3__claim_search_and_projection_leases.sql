-- Claim prose participates in full-text retrieval without duplicating application content.
ALTER TABLE articles ALTER COLUMN search_document DROP EXPRESSION;
CREATE FUNCTION nexus_article_search() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.search_document := setweight(to_tsvector('english',coalesce(NEW.title,'')),'A')
  || setweight(to_tsvector('english',coalesce(NEW.summary,'')),'B')
  || setweight(to_tsvector('english',coalesce((SELECT string_agg(text,' ') FROM claims WHERE article_id=NEW.id),'')),'C');
 RETURN NEW;
END $$;
CREATE TRIGGER article_search BEFORE INSERT OR UPDATE OF title,summary,content ON articles FOR EACH ROW EXECUTE FUNCTION nexus_article_search();
CREATE FUNCTION nexus_claim_search() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN UPDATE articles SET summary=summary WHERE id=OLD.article_id; RETURN OLD; END IF;
 UPDATE articles SET summary=summary WHERE id=NEW.article_id;
 IF TG_OP='UPDATE' AND NEW.article_id<>OLD.article_id THEN UPDATE articles SET summary=summary WHERE id=OLD.article_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER claim_search AFTER INSERT OR UPDATE OR DELETE ON claims FOR EACH ROW EXECUTE FUNCTION nexus_claim_search();
UPDATE articles SET summary=summary;
CREATE TABLE indexing_leases (article_id uuid PRIMARY KEY REFERENCES articles(id), owner uuid NOT NULL, lease_until timestamptz NOT NULL);
