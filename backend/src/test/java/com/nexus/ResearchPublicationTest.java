package com.nexus;

import static org.junit.jupiter.api.Assertions.*;

import com.nexus.common.*;
import com.nexus.indexing.OutboxWorker;
import com.nexus.research.ResearchService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "nexus.worker-initial-delay=3600000",
      "nexus.ai-url=http://127.0.0.1:1",
      "nexus.neo4j-uri=bolt://127.0.0.1:1",
      "nexus.qdrant-url=http://127.0.0.1:1",
      "logging.level.root=WARN"
    })
@Transactional
class ResearchPublicationTest {
  static final EmbeddedPostgres PG;

  static {
    try {
      PG = EmbeddedPostgres.builder().start();
    } catch (Exception e) {
      throw new ExceptionInInitializerError(e);
    }
  }

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", () -> PG.getJdbcUrl("postgres", "postgres"));
    r.add("spring.datasource.username", () -> "postgres");
    r.add("spring.datasource.password", () -> "");
  }

  @AfterAll
  static void close() throws Exception {
    PG.close();
  }

  @org.springframework.test.context.bean.override.mockito.MockitoBean
  com.nexus.research.TaskCoordinator coordinator;

  @Autowired Db db;
  @Autowired ResearchService research;
  @Autowired OutboxWorker outbox;

  @org.junit.jupiter.params.ParameterizedTest
  @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
  void humanApprovalPersistsOnlySelectedClaimsAndQueuesIndexes(boolean acceptGenerated) {
    UUID user = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " users(id,email,password_hash,role)VALUES(?,'publication-reviewer@example.com','hash','REVIEWER')",
        user);
    var job =
        research.create(
            "Integration fixture topic", "Technology", "publication-reviewer@example.com");
    UUID id = (UUID) job.get("id");
    String excerpt =
        "This is an explicit synthetic integration test statement, never production seed data.";
    var state =
        Map.of(
            "sources",
            List.of(
                Map.of(
                    "id",
                    "source-1",
                    "url",
                    "https://arxiv.org/abs/2201.11123",
                    "title",
                    "Integration fixture source",
                    "publisher",
                    "Test fixture",
                    "sourceType",
                    "PREPRINT",
                    "retrievedAt",
                    "2020-06-01T12:00:00Z",
                    "text",
                    excerpt,
                    "license",
                    "Test fixture")),
            "claims",
            List.of(
                Map.of(
                    "id",
                    "claim-1",
                    "text",
                    excerpt,
                    "subject",
                    "Fixture",
                    "predicate",
                    "is",
                    "object",
                    "Fixture",
                    "evidence",
                    List.of(
                        Map.of(
                            "sourceId", "source-1", "excerpt", excerpt, "stance", "SUPPORTS")))));
    db.update(
        "UPDATE research_jobs SET state='REVIEW_REQUIRED',checkpoint=?::jsonb WHERE id=?",
        Json.write(state),
        id);
    db.update(
        "UPDATE research_jobs SET draft=?::jsonb WHERE id=?",
        Json.write(
            Map.of(
                "content",
                Map.of(
                    "sections",
                    List.of(
                        Map.of(
                            "title",
                            "Fixture section",
                            "explanation",
                            "Explicit synthetic test explanation.",
                            "claims",
                            List.of("claim-1")))))),
        id);
    db.update(
        "UPDATE sources SET retrieved_at='2019-01-01T00:00:00Z' WHERE"
            + " url='https://arxiv.org/abs/2201.11123'");
    var published =
        research.approve(
            id,
            new ResearchService.Approval(
                "Reviewed synthetic test evidence",
                "Technology",
                "Testing",
                List.of(
                    new ResearchService.Decision(
                        "claim-1", "UNVERIFIED", "Fixture remains explicitly unverified")),
                acceptGenerated),
            "publication-reviewer@example.com");
    UUID article = (UUID) published.get("id");
    assertEquals("Integration fixture topic", published.get("title"));
    var content = (Map<?, ?>) published.get("content");
    var section = (Map<?, ?>) ((List<?>) content.get("sections")).getFirst();
    assertEquals(acceptGenerated, Boolean.TRUE.equals(section.get("reviewed")));
    assertEquals(acceptGenerated, section.containsKey("explanation"));
    assertEquals(
        acceptGenerated ? "section-1" : "overview",
        db.one("SELECT section_id FROM citations WHERE article_id=?", article).get("section_id"));
    assertEquals(
        2020,
        db.jdbc.queryForObject(
            "SELECT extract(year FROM retrieved_at)::int FROM sources WHERE"
                + " url='https://arxiv.org/abs/2201.11123'",
            Integer.class));
    assertEquals(
        1,
        db.jdbc.queryForObject(
            "SELECT count(*) FROM claims WHERE article_id=?", Integer.class, article));
    assertEquals(
        1,
        db.jdbc.queryForObject(
            "SELECT count(*) FROM citations WHERE article_id=?", Integer.class, article));
    assertEquals(
        1,
        db.jdbc.queryForObject(
            "SELECT count(*) FROM review_records WHERE job_id=?", Integer.class, id));
    assertEquals("APPROVED", db.one("SELECT state FROM research_jobs WHERE id=?", id).get("state"));
    assertEquals(
        "PENDING",
        db.one("SELECT state FROM indexing_outbox WHERE article_id=?", article).get("state"));
  }

  @Test
  void serviceFailurePreservesCheckpointAndStopsBeforePublication() {
    UUID user = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " users(id,email,password_hash,role)VALUES(?,'failure@example.com','hash','READER')",
        user);
    var job = research.create("Failure fixture topic", "Technology", "failure@example.com");
    UUID id = (UUID) job.get("id");
    db.update("UPDATE research_jobs SET checkpoint='{\"stage\":\"PLANNING\"}' WHERE id=?", id);
    research.work();
    var current = db.one("SELECT * FROM research_jobs WHERE id=?", id);
    assertEquals("RETRYING", current.get("state"));
    assertEquals(Map.of("stage", "PLANNING"), current.get("checkpoint"));
    assertNull(current.get("article_id"));
  }

  @Test
  void partialIndexFailureCannotBecomeFullyIndexedAndRetriesAreIdempotent() {
    UUID id =
        (UUID)
            db.one(
                    "SELECT o.id FROM indexing_outbox o JOIN articles a ON a.id=o.article_id AND"
                        + " a.version=o.version ORDER BY o.created_at LIMIT 1")
                .get("id");
    db.update("UPDATE indexing_outbox SET available_at=now()+interval '1 day' WHERE id<>?", id);
    outbox.work();
    var event = db.one("SELECT * FROM indexing_outbox WHERE id=?", id);
    assertEquals("RETRYING", event.get("state"));
    assertEquals(
        2,
        db.jdbc.queryForObject(
            "SELECT count(*) FROM indexing_status WHERE article_id=? AND state='FAILED'",
            Integer.class,
            event.get("article_id")));
    assertEquals(
        "SUCCESS",
        db.one(
                "SELECT state FROM indexing_status WHERE article_id=? AND destination='LEXICAL'",
                event.get("article_id"))
            .get("state"));
    db.update("UPDATE indexing_outbox SET available_at=now() WHERE id=?", id);
    outbox.work();
    assertEquals(
        3,
        db.jdbc.queryForObject(
            "SELECT count(*) FROM indexing_status WHERE article_id=?",
            Integer.class,
            event.get("article_id")));
    assertNotEquals(
        "DONE", db.one("SELECT state FROM indexing_outbox WHERE id=?", id).get("state"));
  }
}
