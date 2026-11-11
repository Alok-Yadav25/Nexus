package com.nexus.articles;

import com.nexus.common.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ArticleService {
  private final Db db;

  public ArticleService(Db db) {
    this.db = db;
  }

  public List<Map<String, Object>> list(int page, int size, String domain) {
    return list(page,size,domain,"recent","");
  }
  public List<Map<String, Object>> list(int page, int size, String domain, String sort, String query) {
    return db.rows(
        "SELECT a.id,a.slug,a.title,a.summary,a.updated_at,a.content#>>'{attributes,Symbol,value}' AS symbol,e.id AS"
            + " entity_id,e.ontology,e.domain,(SELECT count(*) FROM claims c WHERE"
            + " c.article_id=a.id) AS claim_count FROM articles a JOIN entities e ON"
            + " e.id=a.entity_id WHERE a.status='PUBLISHED' AND (?='' OR e.domain=?) AND (?='' OR a.title ILIKE ?) ORDER BY "
            + (sort.equals("title") ? "a.title" : "a.updated_at DESC,a.title") + " LIMIT ? OFFSET ?",
        domain,
        domain,
        query,
        "%"+query+"%",
        Math.clamp(size, 1, 60),
        Math.max(0, page) * Math.clamp(size, 1, 60));
  }

  public Map<String, Object> article(String slug) {
    var a =
        db.one(
            "SELECT a.*,e.ontology,e.domain,e.canonical_id FROM articles a JOIN entities e ON"
                + " e.id=a.entity_id WHERE a.slug=? AND a.status='PUBLISHED'",
            slug);
    Object id = a.get("id");
    a.put("claims", db.rows("SELECT * FROM claims WHERE article_id=? ORDER BY created_at,id", id));
    a.put(
        "sources",
        db.rows(
            "SELECT DISTINCT s.* FROM sources s JOIN claim_evidence ce ON ce.source_id=s.id JOIN"
                + " claims c ON c.id=ce.claim_id WHERE c.article_id=? ORDER BY s.title",
            id));
    a.put("citations", db.rows("SELECT * FROM citations WHERE article_id=?", id));
    a.put(
        "indexing",
        db.rows(
            "SELECT destination,version,state,error FROM indexing_status WHERE article_id=?", id));
    a.put("evidence_summary",db.one("SELECT count(DISTINCT c.id) AS total_claims,count(DISTINCT c.id) FILTER (WHERE c.status='VERIFIED') AS verified_claims,count(ce.id) FILTER (WHERE ce.stance='CONTRADICTS') AS contradicting_excerpts,max(c.last_verified_at) AS last_verified_at FROM claims c LEFT JOIN claim_evidence ce ON ce.claim_id=c.id WHERE c.article_id=?",id));
    return a;
  }

  public Map<String, Object> evidence(UUID id) {
    var claim =
        db.one(
            "SELECT c.*,a.title,a.slug FROM claims c JOIN articles a ON a.id=c.article_id WHERE"
                + " c.id=? AND a.status='PUBLISHED'",
            id);
    claim.put(
        "sources",
        db.rows(
            "SELECT s.*,ce.excerpt,ce.stance FROM sources s JOIN claim_evidence ce ON"
                + " ce.source_id=s.id WHERE ce.claim_id=? ORDER BY s.published_at NULLS"
                + " LAST,s.title",
            id));
    return claim;
  }

  @Transactional
  public Map<String, Object> update(
      UUID id, int version, Map<String, Object> content, String summary, UUID author) {
    db.one("SELECT id FROM articles WHERE id=? FOR UPDATE", id);
    var a = db.one("SELECT * FROM articles WHERE id=?", id);
    if (((Number) a.get("version")).intValue() != version)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Article changed since you opened it. Reload before editing.");
    validateContent(content, id);
    db.update(
        "UPDATE articles SET content=?::jsonb,version=version+1,updated_at=now() WHERE id=?",
        Json.write(content),
        id);
    revision(id, content, summary, author);
    outbox(id);
    return article(a.get("slug").toString());
  }

  @SuppressWarnings("unchecked")
  public void validateContent(Map<String, Object> content, UUID articleId) {
    Object sections = content.get("sections");
    if (!(sections instanceof List<?> list) || list.isEmpty())
      throw new IllegalArgumentException("Sections required");
    var allowed =
        new HashSet<>(
            db.rows("SELECT id FROM claims WHERE article_id=?", articleId).stream()
                .map(x -> x.get("id").toString())
                .toList());
    for (var s : list) {
      if (!(s instanceof Map<?, ?> section)
          || !(section.get("claims") instanceof List<?> ids)
          || ids.isEmpty()
          || !(section.get("title") instanceof String))
        throw new IllegalArgumentException("Every section must cite claims");
      for (Object claim : ids)
        if (!allowed.contains(claim.toString()))
          throw new IllegalArgumentException("Citation does not belong to article");
    }
    Object attributes = content.getOrDefault("attributes", Map.of());
    if (!(attributes instanceof Map<?, ?> values)) throw new IllegalArgumentException();
    for (Object value : values.values()) {
      if (!(value instanceof Map<?, ?> attribute)
          || !allowed.contains(String.valueOf(attribute.get("claimId")))
          || !(attribute.get("value") instanceof String))
        throw new IllegalArgumentException("Attribute requires a claim citation");
    }
  }

  public void outbox(UUID articleId) {
    db.update(
        "INSERT INTO indexing_outbox(id,article_id,version) SELECT ?,id,version FROM articles WHERE"
            + " id=? ON CONFLICT DO NOTHING",
        UUID.randomUUID(),
        articleId);
  }

  public void revision(UUID articleId, Map<String, Object> content, String summary, UUID author) {
    String json = Json.write(content);
    String hash;
    try {
      hash =
          HexFormat.of()
              .formatHex(
                  MessageDigest.getInstance("SHA-256")
                      .digest(json.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
    db.update(
        "INSERT INTO"
            + " article_revisions(id,article_id,number,parent_id,author_id,summary,content,content_hash)"
            + " SELECT ?,a.id,a.version,(SELECT id FROM article_revisions WHERE article_id=a.id"
            + " ORDER BY number DESC LIMIT 1),?,?,?::jsonb,? FROM articles a WHERE a.id=?",
        UUID.randomUUID(),
        author,
        summary,
        json,
        hash,
        articleId);
  }
}
