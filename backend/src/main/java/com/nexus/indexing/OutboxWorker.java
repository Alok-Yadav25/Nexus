package com.nexus.indexing;

import com.nexus.common.*;
import com.nexus.graph.GraphService;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OutboxWorker {
  private final Db db;
  private final GraphService graph;
  private final RestClient ai, qdrant;

  public OutboxWorker(
      Db db,
      GraphService graph,
      @Value("${nexus.ai-url}") String aiUrl,
      @Value("${nexus.qdrant-url}") String qUrl,
      @Value("${nexus.service-token}") String token) {
    this.db = db;
    this.graph = graph;
    var f =
        new org.springframework.http.client.JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(3))
                .build());
    f.setReadTimeout(Duration.ofSeconds(90));
    ai =
        RestClient.builder()
            .baseUrl(aiUrl)
            .requestFactory(f)
            .defaultHeader("X-Service-Token", token)
            .build();
    qdrant = RestClient.builder().baseUrl(qUrl).requestFactory(f).build();
  }

  @Scheduled(initialDelayString = "${nexus.worker-initial-delay:10000}", fixedDelay = 3000)
  public void work() {
    var rows =
        db.rows(
            "UPDATE indexing_outbox SET state='PROCESSING',lease_until=now()+interval '180 seconds'"
                + " WHERE id=(SELECT id FROM indexing_outbox WHERE state IN"
                + " ('PENDING','RETRYING','PROCESSING') AND available_at<=now() AND (lease_until IS"
                + " NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)"
                + " RETURNING *");
    if (rows.isEmpty()) return;
    var event = rows.getFirst();
    UUID id = (UUID) event.get("id"), article = (UUID) event.get("article_id");
    int version = ((Number) event.get("version")).intValue();
    var lease =
        db.rows(
            "INSERT INTO indexing_leases(article_id,owner,lease_until) VALUES(?,?,now()+interval"
                + " '300 seconds') ON CONFLICT(article_id) DO UPDATE SET"
                + " owner=excluded.owner,lease_until=excluded.lease_until WHERE"
                + " indexing_leases.lease_until<now() RETURNING owner",
            article,
            id);
    if (lease.isEmpty()) {
      db.update(
          "UPDATE indexing_outbox SET state='RETRYING',lease_until=NULL,available_at=now()+interval"
              + " '5 seconds' WHERE id=?",
          id);
      return;
    }
    db.update(
        "UPDATE research_jobs SET state='INDEXING' WHERE article_id=? AND state IN"
            + " ('APPROVED','INDEXING')",
        article);
    var current = db.one("SELECT version FROM articles WHERE id=?", article);
    if (((Number) current.get("version")).intValue() != version) {
      db.update("UPDATE indexing_outbox SET state='SUPERSEDED',lease_until=NULL WHERE id=?", id);
      db.update("DELETE FROM indexing_leases WHERE article_id=? AND owner=?", article, id);
      return;
    }
    boolean ok = true;
    for (String destination : List.of("NEO4J", "QDRANT", "LEXICAL")) {
      var done =
          db.rows(
              "SELECT version,state FROM indexing_status WHERE article_id=? AND destination=?",
              article,
              destination);
      if (!done.isEmpty()
          && done.getFirst().get("state").equals("SUCCESS")
          && ((Number) done.getFirst().get("version")).intValue() == version) continue;
      String state = "SUCCESS", error = null;
      try {
        if (destination.equals("NEO4J")) graph.project(article);
        if (destination.equals("QDRANT")) indexVectors(article);
      } catch (Exception e) {
        state = "FAILED";
        error = e.getClass().getSimpleName() + ": destination unavailable; retry retained";
        ok = false;
      }
      db.update(
          "INSERT INTO indexing_status(article_id,destination,version,state,error)"
              + " VALUES(?,?,?,?,?) ON CONFLICT(article_id,destination) DO UPDATE SET"
              + " version=excluded.version,state=excluded.state,error=excluded.error,updated_at=now()"
              + " WHERE indexing_status.version<=excluded.version",
          article,
          destination,
          version,
          state,
          error);
    }
    int attempt = ((Number) event.get("attempts")).intValue() + 1;
    db.update(
        "UPDATE indexing_outbox SET state=?,attempts=?,lease_until=NULL,available_at=now()+(? *"
            + " interval '1 second'),error=? WHERE id=?",
        ok ? "DONE" : attempt >= 5 ? "DEAD" : "RETRYING",
        attempt,
        Math.min(900, 5 * (1 << Math.min(attempt, 7))),
        ok ? null : "One or more index destinations failed",
        id);
    if (ok) {
      db.update(
          "UPDATE quality_issues SET resolved_at=now() WHERE article_id=? AND type IN"
              + " ('INDEXING_FAILED','STALE_INDEX') AND resolved_at IS NULL",
          article);
      db.update(
          "UPDATE research_jobs SET state='PUBLISHED',updated_at=now() WHERE article_id=? AND state"
              + " IN ('APPROVED','INDEXING')",
          article);
    } else if (attempt >= 5)
      db.update(
          "INSERT INTO quality_issues(id,article_id,type,severity,detail)"
              + " VALUES(?,?,'INDEXING_FAILED','HIGH','Index projection exhausted retries. Recheck"
              + " to requeue.') ON CONFLICT(article_id,type) WHERE resolved_at IS NULL DO NOTHING",
          UUID.randomUUID(),
          article);
    db.update("DELETE FROM indexing_leases WHERE article_id=? AND owner=?", article, id);
  }

  @SuppressWarnings("unchecked")
  private void indexVectors(UUID article) {
    try {
      qdrant.get().uri("/collections/article_chunks").retrieve().toBodilessEntity();
    } catch (org.springframework.web.client.HttpClientErrorException.NotFound expected) {
    }
    var a =
        db.one(
            "SELECT a.*,e.ontology,e.domain FROM articles a JOIN entities e ON e.id=a.entity_id"
                + " WHERE a.id=? AND a.status='PUBLISHED'",
            article);
    var content = (Map<String, Object>) a.get("content");
    var sections = (List<Map<String, Object>>) content.get("sections");
    List<String> texts = new ArrayList<>();
    for (var s : sections) {
      var ids = (List<String>) s.get("claims");
      StringBuilder text =
          new StringBuilder(a.get("title").toString() + "\n" + s.get("title") + "\n");
      for (String id : ids)
        text.append(
                db.one(
                        "SELECT text FROM claims WHERE id=? AND article_id=?",
                        UUID.fromString(id),
                        article)
                    .get("text"))
            .append('\n');
      texts.add(text.toString());
    }
    Map<String, Object> embedded =
        ai.post().uri("/embed").body(Map.of("texts", texts)).retrieve().body(Map.class);
    int dimensions = ((Number) embedded.get("dimensions")).intValue();
    try {
      qdrant.get().uri("/collections/article_chunks").retrieve().toBodilessEntity();
    } catch (org.springframework.web.client.HttpClientErrorException.NotFound e) {
      qdrant
          .put()
          .uri("/collections/article_chunks")
          .body(Map.of("vectors", Map.of("size", dimensions, "distance", "Cosine")))
          .retrieve()
          .toBodilessEntity();
    }
    qdrant
        .post()
        .uri("/collections/article_chunks/points/delete?wait=true")
        .body(
            Map.of(
                "filter",
                Map.of(
                    "must",
                    List.of(
                        Map.of(
                            "key", "article_id", "match", Map.of("value", article.toString()))))))
        .retrieve()
        .toBodilessEntity();
    List<Map<String, Object>> points = new ArrayList<>();
    var vectors = (List<?>) embedded.get("vectors");
    for (int i = 0; i < sections.size(); i++) {
      var s = sections.get(i);
      var payload = new LinkedHashMap<String, Object>();
      payload.put("article_id", article.toString());
      payload.put("entity_id", a.get("entity_id").toString());
      payload.put("section_id", s.get("id"));
      payload.put("ontology", a.get("ontology"));
      payload.put("category", a.get("domain"));
      payload.put("content", texts.get(i));
      payload.put(
          "source_ids",
          db
              .rows(
                  "SELECT DISTINCT ce.source_id FROM claim_evidence ce JOIN claims c ON"
                      + " c.id=ce.claim_id WHERE c.article_id=?",
                  article)
              .stream()
              .map(x -> x.get("source_id").toString())
              .toList());
      payload.put("publication_status", "PUBLISHED");
      payload.put("embedding_model", embedded.get("model"));
      payload.put("version", a.get("version"));
      points.add(
          Map.of(
              "id",
              UUID.nameUUIDFromBytes((article + ":" + s.get("id")).getBytes(StandardCharsets.UTF_8))
                  .toString(),
              "vector",
              vectors.get(i),
              "payload",
              payload));
    }
    qdrant
        .put()
        .uri("/collections/article_chunks/points?wait=true")
        .body(Map.of("points", points))
        .retrieve()
        .toBodilessEntity();
  }
}
