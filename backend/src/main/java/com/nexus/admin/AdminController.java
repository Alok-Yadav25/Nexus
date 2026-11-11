package com.nexus.admin;

import com.nexus.common.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
  private final Db db;
  private final RestClient ai;

  public AdminController(
      Db db, @Value("${nexus.ai-url}") String url, @Value("${nexus.service-token}") String token) {
    this.db = db;
    var f =
        new org.springframework.http.client.JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(3))
                .build());
    f.setReadTimeout(Duration.ofSeconds(50));
    ai =
        RestClient.builder()
            .baseUrl(url)
            .requestFactory(f)
            .defaultHeader("X-Service-Token", token)
            .build();
  }

  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  @GetMapping({"", "/analytics"})
  public Object metrics() {
    return Map.of(
        "articles",
        db.count("articles"),
        "entities",
        db.count("entities"),
        "relationships",
        db.count("relationships"),
        "jobs",
        db.rows("SELECT state,count(*) AS count FROM research_jobs GROUP BY state"),
        "verification",
        db.rows("SELECT status,count(*) AS count FROM claims GROUP BY status"),
        "indexes",
        db.rows(
            "SELECT destination,state,count(*) AS count FROM indexing_status GROUP BY"
                + " destination,state"),
        "search",
        db.one(
            "SELECT count(*) AS searches,round(avg(latency_ms)) AS"
                + " average_latency_ms,percentile_cont(0.95) WITHIN GROUP(ORDER BY latency_ms) AS"
                + " p95_latency_ms FROM search_logs WHERE created_at>now()-interval '24 hours'"),
        "openIssues",
        db.jdbc.queryForObject(
            "SELECT count(*) FROM quality_issues WHERE resolved_at IS NULL", Long.class));
  }

  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  @GetMapping("/reviews")
  public Object reviews() {
    return db.rows(
        "SELECT id,topic,ontology,state,created_at FROM research_jobs WHERE state='REVIEW_REQUIRED'"
            + " ORDER BY created_at");
  }

  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  @GetMapping("/quality")
  public Object quality() {
    return db.rows(
        "SELECT q.*,a.title,a.slug FROM quality_issues q LEFT JOIN articles a ON a.id=q.article_id"
            + " WHERE q.resolved_at IS NULL ORDER BY q.created_at DESC LIMIT 200");
  }

  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  @PostMapping("/quality/scan")
  public Object scan() {
    scanLocal();
    return quality();
  }

  @Scheduled(initialDelayString = "${nexus.worker-initial-delay:10000}", fixedDelay = 3600000)
  public void scanLocal() {
    for (var a : db.rows("SELECT id,updated_at FROM articles WHERE status='PUBLISHED'")) {
      UUID id = (UUID) a.get("id");
      Long missing =
          db.jdbc.queryForObject(
              "SELECT count(*) FROM claims c WHERE article_id=? AND NOT EXISTS(SELECT 1 FROM"
                  + " claim_evidence ce WHERE ce.claim_id=c.id)",
              Long.class,
              id);
      if (missing > 0) issue(id, "MISSING_EVIDENCE", "HIGH", missing + " claims have no evidence");
      Long failed =
          db.jdbc.queryForObject(
              "SELECT count(*) FROM indexing_status WHERE article_id=? AND state='FAILED'",
              Long.class,
              id);
      if (failed > 0) issue(id, "INDEXING_FAILED", "HIGH", failed + " index destinations failed");
      Long orphan =
          db.jdbc.queryForObject(
              "SELECT count(*) FROM articles a WHERE a.id=? AND NOT EXISTS(SELECT 1 FROM"
                  + " relationships r WHERE r.from_entity=a.entity_id OR r.to_entity=a.entity_id)",
              Long.class,
              id);
      if (orphan > 0)
        issue(id, "ORPHAN_ENTITY", "LOW", "Entity has no evidenced graph relationships");
      Long stale =
          db.jdbc.queryForObject(
              "SELECT count(*) FROM articles WHERE id=? AND updated_at<now()-interval '365 days'",
              Long.class,
              id);
      if (stale > 0)
        issue(id, "STALE_ARTICLE", "MEDIUM", "Article has not been reviewed within one year");
      Long conflicted =
          db.jdbc.queryForObject(
              "SELECT count(*) FROM claims WHERE article_id=? AND status='DISPUTED'",
              Long.class,
              id);
      if (conflicted > 0)
        issue(
            id,
            "CONFLICTED_CLAIMS",
            "HIGH",
            "Article contains disputed claims; preserve contradictory evidence");
      Long staleIndex =
          db.jdbc.queryForObject(
              "SELECT count(*) FROM indexing_status s JOIN articles a ON a.id=s.article_id WHERE"
                  + " a.id=? AND s.version<a.version",
              Long.class,
              id);
      if (staleIndex > 0)
        issue(
            id, "STALE_INDEX", "MEDIUM", "An index projection is older than the canonical article");
    }
  }

  private void issue(UUID id, String type, String severity, String detail) {
    db.update(
        "INSERT INTO quality_issues(id,article_id,type,severity,detail) VALUES(?,?,?,?,?) ON"
            + " CONFLICT(article_id,type) WHERE resolved_at IS NULL DO NOTHING",
        UUID.randomUUID(),
        id,
        type,
        severity,
        detail);
  }

  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  @PostMapping("/quality/{id}/recheck")
  public Object recheck(@PathVariable UUID id) {
    var q = db.one("SELECT * FROM quality_issues WHERE id=?", id);
    if (q.get("type").equals("INDEXING_FAILED")) {
      db.update(
          "UPDATE indexing_outbox SET"
              + " state='PENDING',attempts=0,available_at=now(),lease_until=NULL WHERE article_id=?"
              + " AND state='DEAD'",
          q.get("article_id"));
      return Map.of("message", "Indexing requeued. Issue remains open until projections succeed.");
    }
    boolean resolved = false;
    UUID article = (UUID) q.get("article_id");
    String type = q.get("type").toString();
    if (type.equals("MISSING_EVIDENCE"))
      resolved =
          db.jdbc.queryForObject(
                  "SELECT count(*) FROM claims c WHERE c.article_id=? AND NOT EXISTS(SELECT 1 FROM"
                      + " claim_evidence ce WHERE ce.claim_id=c.id)",
                  Long.class,
                  article)
              == 0;
    if (type.equals("ORPHAN_ENTITY"))
      resolved =
          db.jdbc.queryForObject(
                  "SELECT count(*) FROM relationships r JOIN articles a ON"
                      + " a.entity_id=r.from_entity OR a.entity_id=r.to_entity WHERE a.id=?",
                  Long.class,
                  article)
              > 0;
    if (type.equals("STALE_ARTICLE"))
      resolved =
          db.jdbc.queryForObject(
                  "SELECT count(*) FROM articles WHERE id=? AND updated_at>now()-interval '365"
                      + " days'",
                  Long.class,
                  article)
              > 0;
    if (type.equals("CONFLICTED_CLAIMS"))
      resolved =
          db.jdbc.queryForObject(
                  "SELECT count(*) FROM claims WHERE article_id=? AND status='DISPUTED'",
                  Long.class,
                  article)
              == 0;
    if (type.equals("SOURCE_UNAVAILABLE")) {
      resolved = true;
      for (var source :
          db.rows(
              "SELECT DISTINCT s.id FROM sources s JOIN claim_evidence ce ON ce.source_id=s.id JOIN"
                  + " claims c ON c.id=ce.claim_id WHERE c.article_id=? LIMIT 10",
              article)) {
        Map<String, Object> checked = (Map<String, Object>) check((UUID) source.get("id"));
        if (!checked.get("state").equals("AVAILABLE")) resolved = false;
      }
    }
    if (resolved) db.update("UPDATE quality_issues SET resolved_at=now() WHERE id=?", id);
    return db.one("SELECT * FROM quality_issues WHERE id=?", id);
  }

  @SuppressWarnings("unchecked")
  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  @PostMapping("/sources/{id}/check")
  public Object check(@PathVariable UUID id) {
    var source = db.one("SELECT * FROM sources WHERE id=?", id);
    Map<String, Object> result =
        ai.post()
            .uri("/source/check")
            .body(Map.of("url", source.get("url")))
            .retrieve()
            .body(Map.class);
    db.update(
        "UPDATE sources SET health=?,last_checked_at=now() WHERE id=?", result.get("state"), id);
    if (result.get("state").equals("UNAVAILABLE"))
      for (var a :
          db.rows(
              "SELECT DISTINCT c.article_id FROM claims c JOIN claim_evidence ce ON"
                  + " ce.claim_id=c.id WHERE ce.source_id=?",
              id))
        issue(
            (UUID) a.get("article_id"),
            "SOURCE_UNAVAILABLE",
            "MEDIUM",
            "A source could not be fetched. Network failure is not proof of a broken citation."
                + " Revalidate; preserve history.");
    return result;
  }

  @Scheduled(initialDelayString = "${nexus.worker-initial-delay:30000}", fixedDelay = 3600000)
  public void sourceHealth() {
    var sources =
        db.rows(
            "SELECT id FROM sources WHERE last_checked_at IS NULL OR last_checked_at<now()-interval"
                + " '7 days' ORDER BY last_checked_at NULLS FIRST LIMIT 1");
    if (!sources.isEmpty())
      try {
        check((UUID) sources.getFirst().get("id"));
      } catch (Exception ignored) {
        /* A service failure is not evidence of a broken source. */
      }
  }

  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  @GetMapping("/health")
  public Object health() {
    return Map.of(
        "database",
        "UP",
        "indexStatus",
        db.rows(
            "SELECT destination,state,count(*) AS count FROM indexing_status GROUP BY"
                + " destination,state"),
        "outbox",
        db.rows("SELECT state,count(*) AS count FROM indexing_outbox GROUP BY state"));
  }
}
