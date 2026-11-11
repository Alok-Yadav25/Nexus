package com.nexus;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.nexus.articles.ArticleService;
import com.nexus.common.*;
import com.nexus.research.ResearchService;
import com.nexus.search.SearchService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {"nexus.worker-initial-delay=3600000", "logging.level.root=WARN"})
@AutoConfigureMockMvc
@Transactional
class PlatformIntegrationTest {
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

  @Autowired MockMvc mvc;

  @org.springframework.test.context.bean.override.mockito.MockitoBean
  com.nexus.research.TaskCoordinator coordinator;

  @Autowired Db db;
  @Autowired SearchService search;
  @Autowired ArticleService articles;
  @Autowired ResearchService research;

  UUID entity(String slug) {
    return (UUID) db.one("SELECT id FROM entities WHERE slug=?", slug).get("id");
  }

  @Test
  void articlesAndEvidenceArePersistedAndPublic() throws Exception {
    mvc.perform(get("/api/v1/articles/lithium"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.claims.length()").value(5))
        .andExpect(jsonPath("$.sources[0].publisher").value("Royal Society of Chemistry"));
    UUID claim =
        (UUID)
            db.one(
                    "SELECT c.id FROM claims c JOIN articles a ON a.id=c.article_id WHERE"
                        + " a.slug='lithium' LIMIT 1")
                .get("id");
    mvc.perform(get("/api/v1/evidence/" + claim))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sources[0].excerpt").isNotEmpty());
  }

  @Test
  void aliasAutocompleteAndFullTextUseActualRecords() throws Exception {
    search.rebuild();
    mvc.perform(get("/api/v1/search/suggestions").param("q", "Li"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].slug").value("lithium"));
    mvc.perform(get("/api/v1/search").param("q", "Li"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.classification").value("EXISTING_ARTICLE"));
    assertEquals(
        1,
        db.jdbc.queryForObject("SELECT count(*) FROM search_logs WHERE query='li'", Integer.class));
  }

  @Test
  void unknownSearchDoesNotCreateResearch() throws Exception {
    long before = db.count("research_jobs");
    mvc.perform(get("/api/v1/search").param("q", "unindexed test topic"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty());
    assertEquals(before, db.count("research_jobs"));
  }

  @Test
  void verifiedPathsAndMissingPathsAreHonest() throws Exception {
    mvc.perform(
            get("/api/v1/graph/path")
                .param("from", entity("alkali-metals").toString())
                .param("to", entity("lithium-ion-batteries").toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths[0].length").value(2));
    mvc.perform(
            get("/api/v1/graph/path")
                .param("from", entity("lithium").toString())
                .param("to", entity("vibranium").toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths").isEmpty());
  }

  @Test
  void fictionalAndHypotheticalOntologiesStayLabeled() throws Exception {
    mvc.perform(get("/api/v1/articles/vibranium"))
        .andExpect(jsonPath("$.ontology").value("FictionalEntity"))
        .andExpect(jsonPath("$.claims[0].status").value("FICTIONAL_CANON"));
    mvc.perform(get("/api/v1/articles/dyson-sphere"))
        .andExpect(jsonPath("$.claims[0].status").value("THEORETICAL_MODEL"));
  }

  @Test
  void timelinesKeepYearPrecision() throws Exception {
    mvc.perform(get("/api/v1/timeline/" + entity("lithium")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.events[0].event_date").value("1817-01-01"))
        .andExpect(jsonPath("$.events[0].date_precision").value("YEAR"));
  }

  @Test
  void comparisonDoesNotFillMissingAttributes() throws Exception {
    mvc.perform(
            post("/api/v1/compare")
                .with(csrf())
                .contentType("application/json")
                .content(
                    Json.write(
                        Map.of("entities", List.of(entity("lithium"), entity("dyson-sphere"))))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[1].attributes['Atomic number']").doesNotExist());
  }

  @Test
  void authenticationSessionAndCsrfAreEnforced() throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType("application/json")
                .content("{\"email\":\"alice@example.com\",\"password\":\"strong-test-password\"}"))
        .andExpect(status().isForbidden());
    var result =
        mvc.perform(
                post("/api/v1/auth/register")
                    .with(csrf())
                    .contentType("application/json")
                    .content(
                        "{\"email\":\"alice@example.com\",\"password\":\"strong-test-password\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("READER"))
            .andReturn();
    var session = (MockHttpSession) result.getRequest().getSession(false);
    mvc.perform(get("/api/v1/auth/me").session(session))
        .andExpect(jsonPath("$.authenticated").value(true));
    mvc.perform(get("/api/v1/admin/analytics").session(session)).andExpect(status().isForbidden());
    mvc.perform(
            post("/api/v1/auth/login")
                .with(csrf())
                .contentType("application/json")
                .content("{\"email\":\"alice@example.com\",\"password\":\"wrong-password-value\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void duplicateJobAndPrivateOwnershipAreEnforced() {
    UUID user = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " users(id,email,password_hash,role)VALUES(?,'research@example.com','hash','READER')",
        user);
    var first = research.create("Novel Research Topic", "Technology", "research@example.com");
    var again = research.create("  NOVEL   research topic  ", "Technology", "research@example.com");
    assertEquals(first.get("id"), again.get("id"));
    assertEquals(1, db.count("research_jobs"));
    UUID other = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " users(id,email,password_hash,role)VALUES(?,'other@example.com','hash','READER')",
        other);
    assertThrows(
        org.springframework.web.server.ResponseStatusException.class,
        () -> research.get((UUID) first.get("id"), "other@example.com"));
  }

  @SuppressWarnings("unchecked")
  @Test
  void restorationCreatesRevisionAndOutboxAndRejectsLostEdits() {
    var article = articles.article("lithium");
    UUID id = (UUID) article.get("id");
    var content = new LinkedHashMap<>((Map<String, Object>) article.get("content"));
    content.put("editorialNote", "Revised editorial note");
    articles.update(id, 1, content, "Clarify editorial note", null);
    assertEquals(
        2, db.jdbc.queryForObject("SELECT version FROM articles WHERE id=?", Integer.class, id));
    assertEquals(
        2,
        db.jdbc.queryForObject(
            "SELECT count(*) FROM article_revisions WHERE article_id=?", Integer.class, id));
    assertEquals(
        2,
        db.jdbc.queryForObject(
            "SELECT count(*) FROM indexing_outbox WHERE article_id=?", Integer.class, id));
    assertThrows(
        org.springframework.web.server.ResponseStatusException.class,
        () -> articles.update(id, 1, content, "Stale edit", null));
    var old =
        (Map<String, Object>)
            db.one("SELECT content FROM article_revisions WHERE article_id=? AND number=1", id)
                .get("content");
    articles.update(id, 2, old, "Restored revision 1", null);
    assertEquals(
        3, db.jdbc.queryForObject("SELECT version FROM articles WHERE id=?", Integer.class, id));
  }

  @Test
  void researchCannotPublishBeforeReview() {
    UUID uid = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " users(id,email,password_hash,role)VALUES(?,'reviewer@example.com','hash','REVIEWER')",
        uid);
    var job = research.create("Unreviewed Research", "Technology", "reviewer@example.com");
    assertThrows(
        org.springframework.web.server.ResponseStatusException.class,
        () ->
            research.approve(
                (UUID) job.get("id"),
                new ResearchService.Approval(
                    "Inspect all sources", "Technology", "Science", List.of()),
                "reviewer@example.com"));
  }

  @Test
  void readerCannotRestoreAndPrivateJobsRequireLogin() throws Exception {
    UUID id = (UUID) articles.article("lithium").get("id");
    mvc.perform(
            post("/api/v1/articles/" + id + "/restore")
                .with(user("reader").roles("READER"))
                .with(csrf())
                .contentType("application/json")
                .content("{\"number\":1,\"version\":1}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/research")).andExpect(status().isUnauthorized());
  }

  @Test
  void corsPermitsOnlyConfiguredOrigins() throws Exception {
    mvc.perform(get("/api/v1/auth/csrf").header("Origin", "http://127.0.0.1:3000"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:3000"));
    mvc.perform(get("/api/v1/auth/csrf").header("Origin", "https://attacker.example"))
        .andExpect(status().isForbidden());
  }

  @Test
  void revisionHashesMatchCanonicalSnapshotReconstruction() throws Exception {
    for (var revision : db.rows("SELECT content,content_hash FROM article_revisions")) {
      String hash =
          java.util.HexFormat.of()
              .formatHex(
                  java.security.MessageDigest.getInstance("SHA-256")
                      .digest(
                          Json.write(revision.get("content"))
                              .getBytes(java.nio.charset.StandardCharsets.UTF_8)));
      assertEquals(revision.get("content_hash"), hash);
    }
  }

  @Test
  void emptyAnalyticsDoNotInventLatency() throws Exception {
    mvc.perform(get("/api/v1/admin/analytics").with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.search.searches").value(0))
        .andExpect(jsonPath("$.search.average_latency_ms").value(org.hamcrest.Matchers.nullValue()))
        .andExpect(jsonPath("$.search.p95_latency_ms").value(org.hamcrest.Matchers.nullValue()));
  }
  @Test
  void publicRevisionsExcludePrivateEmailAndAccountIds() throws Exception {
    UUID uid=UUID.randomUUID();String email="revision-private@example.test";
    db.update("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,'test-hash','READER')",uid,email);
    UUID article=(UUID)db.one("SELECT id FROM articles WHERE slug='lithium'").get("id");
    db.update("UPDATE article_revisions SET author_id=? WHERE article_id=?",uid,article);
    String json=mvc.perform(get("/api/v1/articles/"+article+"/revisions")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    assertFalse(json.contains(email));assertFalse(json.contains(uid.toString()));assertTrue(json.contains("Contributor"));
  }

  @Test
  void persistedSaveMembershipCanBeReadAndRemoved() throws Exception {
    UUID uid=UUID.randomUUID();String email="save-regression@example.test";
    db.update("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,'test-hash','READER')",uid,email);
    UUID article=(UUID)db.one("SELECT id FROM articles WHERE slug='lithium'").get("id");
    String path="/api/v1/articles/"+article;
    mvc.perform(get(path+"/saved").with(user(email).roles("READER"))).andExpect(jsonPath("$.saved").value(false));
    mvc.perform(post(path+"/save").with(csrf()).with(user(email).roles("READER"))).andExpect(status().isOk());
    mvc.perform(get(path+"/saved").with(user(email).roles("READER"))).andExpect(jsonPath("$.saved").value(true));
    mvc.perform(delete(path+"/save").with(csrf()).with(user(email).roles("READER"))).andExpect(status().isOk());
    mvc.perform(get(path+"/saved").with(user(email).roles("READER"))).andExpect(jsonPath("$.saved").value(false));
  }

  @Test
  void neighborhoodFindsAnEntityOutsideTheGlobalFirstPage() throws Exception {
    for(int i=0;i<170;i++)db.update("INSERT INTO entities(id,name,slug,ontology,domain,description) VALUES(?,?,?,'Technology','Testing','Isolated test fixture')",UUID.randomUUID(),"AAA fixture "+i,"test-fixture-"+i);
    UUID target=UUID.randomUUID();db.update("INSERT INTO entities(id,name,slug,ontology,domain,description) VALUES(?,'ZZZ target','target-outside-global-page','Technology','Testing','Isolated adjacency regression fixture')",target);
    UUID lithium=entity("lithium");UUID claim=(UUID)db.one("SELECT id FROM claims WHERE article_id=(SELECT id FROM articles WHERE slug='lithium') LIMIT 1").get("id");
    db.update("INSERT INTO relationships(id,from_entity,to_entity,type,claim_id,status) VALUES(?,?,?,'RELATED_TO',?,'VERIFIED')",UUID.randomUUID(),target,lithium,claim);
    mvc.perform(get("/api/v1/graph/entity/"+target).param("depth","1")).andExpect(status().isOk()).andExpect(jsonPath("$.nodes.length()").value(2)).andExpect(jsonPath("$.edges.length()").value(1)).andExpect(jsonPath("$.complete").value(true));
  }

  @Test
  void journeyProgressIsPersistentAndOwned() throws Exception {
    String email="journey-owner@example.test";UUID uid=UUID.randomUUID();db.update("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,'test-hash','READER')",uid,email);
    String json=mvc.perform(post("/api/v1/journeys").with(csrf()).with(user(email).roles("READER")).contentType("application/json").content(Json.write(Map.of("from",entity("alkali-metals"),"to",entity("lithium-ion-batteries"),"level","BEGINNER")))).andExpect(status().isOk()).andExpect(jsonPath("$.nodes.nodes.length()").value(3)).andReturn().getResponse().getContentAsString();
    String id=Json.map(json).get("id").toString();
    mvc.perform(post("/api/v1/journeys/"+id+"/progress").with(csrf()).with(user(email).roles("READER")).contentType("application/json").content(Json.write(Map.of("entity",entity("alkali-metals"),"complete",true)))).andExpect(jsonPath("$.completed[0]").value(entity("alkali-metals").toString()));
    mvc.perform(get("/api/v1/journeys/"+id).with(user(email).roles("READER"))).andExpect(jsonPath("$.completed.length()").value(1));
    mvc.perform(get("/api/v1/journeys/"+id)).andExpect(status().isUnauthorized());
  }

  @Test
  void canonicalIdentityIsNotASubjectNameMerge() {
    String email="identity-owner@example.test";db.update("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,'test-hash','READER')",UUID.randomUUID(),email);
    var a=research.create("Mercury","Planet",email,"wikidata:Q308");var b=research.create("Mercury","ChemicalElement",email,"wikidata:Q925");
    assertNotEquals(a.get("id"),b.get("id"));
    assertThrows(IllegalArgumentException.class,()->research.create("Private target","Technology",email,"https://127.0.0.1/secret"));
  }

}
