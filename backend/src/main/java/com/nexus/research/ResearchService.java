package com.nexus.research;

import com.nexus.articles.ArticleService;
import com.nexus.common.*;
import com.nexus.search.RadixTrie;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ResearchService {
  private final Db db;
  private final ArticleService articles;
  private final RestClient ai;
  private final TaskCoordinator coordinator;
  private final com.nexus.search.SearchService search;
  public static final Set<String> ONTOLOGIES =
      Set.of(
          "Planet",
          "ChemicalCompound",
          "CelestialObject",
          "Food",
          "BiologicalEntity",
          "Person",
          "Organization",
          "Place",
          "Event",
          "ChemicalElement",
          "Material",
          "Technology",
          "ScientificTheory",
          "MathematicalConcept",
          "HistoricalConcept",
          "Publication",
          "FictionalEntity",
          "FictionalLocation",
          "HypotheticalTechnology",
          "UNCLASSIFIED");

  public ResearchService(
      Db db,
      ArticleService articles,
      TaskCoordinator coordinator,
      com.nexus.search.SearchService search,
      @Value("${nexus.ai-url}") String url,
      @Value("${nexus.service-token}") String token) {
    this.db = db;
    this.coordinator = coordinator;
    this.search = search;
    this.articles = articles;
    var f =
        new org.springframework.http.client.JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(3))
                .build());
    f.setReadTimeout(Duration.ofSeconds(70));
    ai =
        RestClient.builder()
            .baseUrl(url)
            .requestFactory(f)
            .defaultHeader("X-Service-Token", token)
            .build();
  }

  public Map<String, Object> user(String email) {
    return db.one("SELECT id,role FROM users WHERE email=?", email);
  }

  public Map<String, Object> get(UUID id, String email) {
    var job = db.one("SELECT * FROM research_jobs WHERE id=?", id);
    var user = user(email);
    if (!job.get("requested_by").equals(user.get("id"))
        && !Set.of("ADMIN", "REVIEWER").contains(user.get("role")))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This research job is private");
    job.put("events", db.rows("SELECT * FROM research_job_events WHERE job_id=? ORDER BY id", id));
    return job;
  }

  @Transactional
  public Map<String, Object> create(String topic, String ontology, String email) {
    return create(topic, ontology, email, null);
  }

  @Transactional
  public Map<String, Object> create(
      String topic, String ontology, String email, String canonicalId) {
    if (canonicalId != null
        && !canonicalId.isBlank()
        && !canonicalId.matches("(?:wikidata:Q[1-9][0-9]*|enwiki:[1-9][0-9]*)"))
      throw new IllegalArgumentException();
    String normalized = RadixTrie.normalize(topic);
    String identity = canonicalId == null || canonicalId.isBlank() ? normalized : canonicalId;

    if (normalized.length() < 2 || normalized.length() > 240 || !ONTOLOGIES.contains(ontology))
      throw new IllegalArgumentException();
    var existing =
        db.rows(
            "SELECT e.slug FROM entities e LEFT JOIN entity_aliases al ON al.entity_id=e.id WHERE"
                + " (?<>'' AND e.canonical_id=?) OR (?='' AND (lower(e.name)=? OR"
                + " al.normalized=?))",
            canonicalId == null ? "" : canonicalId,
            canonicalId == null ? "" : canonicalId,
            canonicalId == null ? "" : canonicalId,
            normalized,
            normalized);
    if (!existing.isEmpty())
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "An entity already exists: " + existing.getFirst().get("slug"));
    UUID id = UUID.randomUUID();
    var created =
        db.rows(
            "INSERT INTO"
                + " research_jobs(id,topic,normalized_topic,ontology,requested_by,canonical_id)"
                + " VALUES(?,?,?,?,?,?) ON CONFLICT(normalized_topic) WHERE state NOT IN"
                + " ('FAILED','CANCELLED','PUBLISHED','REJECTED') DO NOTHING RETURNING id",
            id,
            topic.strip(),
            identity,
            ontology,
            user(email).get("id"),
            canonicalId);
    if (created.isEmpty()) {
      var prior =
          db.one(
              "SELECT id,requested_by FROM research_jobs WHERE normalized_topic=? AND state NOT IN"
                  + " ('FAILED','CANCELLED','PUBLISHED','REJECTED')",
              identity);
      if (!prior.get("requested_by").equals(user(email).get("id")))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "Research on this topic is already in progress");
      return get((UUID) prior.get("id"), email);
    }
    event(id, "QUEUED", "Research requested; awaiting worker");
    afterCommit(() -> coordinator.signal(id));
    return get(id, email);
  }

  public void event(UUID id, String stage, String message) {
    db.update(
        "INSERT INTO research_job_events(job_id,stage,message) VALUES(?,?,?)", id, stage, message);
    afterCommit(() -> coordinator.event(id, stage, message));
    org.slf4j.LoggerFactory.getLogger(ResearchService.class)
        .info("research_stage jobId={} stage={}", id, stage);
  }

  @Scheduled(initialDelayString = "${nexus.worker-initial-delay:10000}", fixedDelay = 1800)
  @SuppressWarnings("unchecked")
  public void work() {
    var hint = coordinator.next();
    java.util.List<java.util.Map<String, Object>> jobs = java.util.List.of();
    if (hint.isPresent())
      jobs =
          db.rows(
              "UPDATE research_jobs SET lease_until=now()+interval '120 seconds' WHERE id=? AND"
                  + " state NOT IN"
                  + " ('REVIEW_REQUIRED','APPROVED','INDEXING','PUBLISHED','FAILED','CANCELLED','REJECTED')"
                  + " AND (lease_until IS NULL OR lease_until<now()) RETURNING *",
              hint.get());
    if (jobs.isEmpty())
      jobs =
          db.rows(
              "UPDATE research_jobs SET lease_until=now()+interval '120 seconds' WHERE id=(SELECT"
                  + " id FROM research_jobs WHERE state NOT IN"
                  + " ('REVIEW_REQUIRED','APPROVED','INDEXING','PUBLISHED','FAILED','CANCELLED','REJECTED')"
                  + " AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE"
                  + " SKIP LOCKED LIMIT 1) RETURNING *");
    if (jobs.isEmpty()) return;
    var job = jobs.getFirst();
    UUID id = (UUID) job.get("id");
    try {
      Map<String, Object> state =
          ai.post()
              .uri("/research/{id}/step", id)
              .body(
                  Map.of(
                      "topic",
                      job.get("topic"),
                      "ontology",
                      job.get("ontology"),
                      "canonical_id",
                      job.get("canonical_id") == null ? "" : job.get("canonical_id")))
              .retrieve()
              .body(Map.class);
      String stage = state.get("stage").toString();
      db.update(
          "UPDATE research_jobs SET"
              + " state=?,checkpoint=?::jsonb,draft=?::jsonb,error=NULL,lease_until=NULL,updated_at=now()"
              + " WHERE id=? AND state NOT IN ('CANCELLED','REJECTED')",
          stage,
          Json.write(state),
          state.containsKey("draft") ? Json.write(state.get("draft")) : null,
          id);
      event(id, stage, "Completed " + stage.toLowerCase(Locale.ROOT).replace('_', ' '));
      if (!stage.equals("REVIEW_REQUIRED")) coordinator.signal(id);
    } catch (Exception e) {
      int attempts = ((Number) job.get("attempts")).intValue() + 1;
      String state = attempts >= 3 ? "FAILED" : "RETRYING";
      db.update(
          "UPDATE research_jobs SET state=?,attempts=?,error=?,lease_until=now()+(? * interval '1"
              + " second'),updated_at=now() WHERE id=? AND state NOT IN ('CANCELLED','REJECTED')",
          state,
          attempts,
          "Research service failed: " + e.getClass().getSimpleName(),
          Math.min(300, 10 * (1 << attempts)),
          id);
      event(id, state, "Service failure. Checkpoint retained; attempt " + attempts + " of 3.");
    }
  }

  public record Decision(String claimId, String status, String rationale) {}

  public record Approval(
      String notes,
      String ontology,
      String domain,
      List<Decision> claims,
      Boolean acceptGeneratedText) {
    public Approval(String notes, String ontology, String domain, List<Decision> claims) {
      this(notes, ontology, domain, claims, false);
    }
  }

  @Transactional
  @SuppressWarnings("unchecked")
  public Map<String, Object> approve(UUID jobId, Approval body, String email) {
    var job = db.one("SELECT * FROM research_jobs WHERE id=? FOR UPDATE", jobId);
    if (!job.get("state").equals("REVIEW_REQUIRED"))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Job is not ready for review");
    if (body.notes() == null
        || body.notes().length() < 12
        || body.notes().length() > 2000
        || body.domain() == null
        || body.domain().isBlank()
        || body.domain().length() > 80
        || !ONTOLOGIES.contains(body.ontology())
        || body.ontology().equals("UNCLASSIFIED")) throw new IllegalArgumentException();
    var state = (Map<String, Object>) job.get("checkpoint");
    var sourceRows = (List<Map<String, Object>>) state.getOrDefault("sources", List.of());
    var claimRows = (List<Map<String, Object>>) state.getOrDefault("claims", List.of());
    if (sourceRows.isEmpty()
        || claimRows.isEmpty()
        || body.claims() == null
        || body.claims().isEmpty()) throw new IllegalArgumentException();
    Map<String, Decision> decisions = new LinkedHashMap<>();
    for (Decision d : body.claims()) {
      if (d.rationale() == null
          || d.rationale().length() < 12
          || d.rationale().length() > 2000
          || decisions.put(d.claimId(), d) != null) throw new IllegalArgumentException();
    }
    boolean fictional = body.ontology().startsWith("Fictional"),
        theory = body.ontology().equals("HypotheticalTechnology");
    Set<String> allowed =
        fictional
            ? Set.of("FICTIONAL_CANON")
            : theory
                ? Set.of("THEORETICAL_MODEL")
                : Set.of("VERIFIED", "PARTIALLY_VERIFIED", "DISPUTED", "UNVERIFIED");
    for (Decision d : decisions.values())
      if (!allowed.contains(d.status())) throw new IllegalArgumentException();
    String slug =
        java.text.Normalizer.normalize(job.get("topic").toString(), java.text.Normalizer.Form.NFKD)
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-|-$", "");
    if (slug.isBlank()) slug = "topic-" + jobId.toString().substring(0, 8);
    UUID eid = UUID.randomUUID(), aid = UUID.randomUUID();
    if (job.get("canonical_id") != null)
      slug =
          slug.substring(0, Math.min(150, slug.length()))
              + "-"
              + job.get("canonical_id")
                  .toString()
                  .replaceAll("[^A-Za-z0-9]", "-")
                  .toLowerCase(Locale.ROOT);
    db.update(
        "INSERT INTO entities(id,name,slug,ontology,domain,description) VALUES(?,?,?,?,?,?)",
        eid,
        job.get("topic"),
        slug,
        body.ontology(),
        body.domain(),
        job.get("topic"));
    if (job.get("canonical_id") != null)
      db.update("UPDATE entities SET canonical_id=? WHERE id=?", job.get("canonical_id"), eid);
    Map<String, Object> content = new LinkedHashMap<>();
    content.put("schemaVersion", 1);
    content.put("attributes", Map.of());
    content.put(
        "editorialNote",
        "Human-reviewed extractive research notes. Source statements retain their labeled"
            + " verification status.");
    List<String> claimIds = new ArrayList<>();
    Map<String, String> publishedClaimIds = new HashMap<>();
    String summary = "";
    Map<String, UUID> sourceIds = new HashMap<>();
    for (var s : sourceRows) {
      String url = s.get("url").toString();
      java.time.OffsetDateTime retrieved;
      try {
        retrieved = java.time.OffsetDateTime.parse(Objects.toString(s.get("retrievedAt"), ""));
        if (retrieved.isAfter(java.time.OffsetDateTime.now().plusMinutes(5)))
          throw new IllegalArgumentException("Future source retrieval timestamp");
      } catch (java.time.format.DateTimeParseException invalid) {
        throw new IllegalArgumentException("Source retrieval timestamp is missing or invalid");
      }
      UUID sid = UUID.randomUUID();
      var saved =
          db.one(
              "INSERT INTO"
                  + " sources(id,url,title,publisher,source_type,published_at,license,retrieved_at)"
                  + " VALUES(?,?,?,?,?,?::date,?,?) ON CONFLICT(url) DO UPDATE SET"
                  + " retrieved_at=GREATEST(sources.retrieved_at,excluded.retrieved_at) RETURNING"
                  + " id",
              sid,
              url,
              s.get("title"),
              s.get("publisher"),
              s.get("sourceType"),
              s.get("publishedAt"),
              s.get("license"),
              retrieved);
      sourceIds.put(s.get("id").toString(), (UUID) saved.get("id"));
    }
    db.update(
        "INSERT INTO articles(id,entity_id,slug,title,summary,content,status)"
            + " VALUES(?,?,?,?,?,'{}','PUBLISHED')",
        aid,
        eid,
        slug,
        job.get("topic"),
        "Review in progress");
    for (var c : claimRows) {
      Decision d = decisions.remove(c.get("id").toString());
      if (d == null) continue;
      UUID cid = UUID.randomUUID();
      var evidence = (List<Map<String, Object>>) c.getOrDefault("evidence", List.of());
      if (evidence.isEmpty()) throw new IllegalArgumentException("Missing evidence");
      db.update(
          "INSERT INTO claims(id,article_id,text,subject,predicate,object,status,rationale)"
              + " VALUES(?,?,?,?,?,?,?,?)",
          cid,
          aid,
          c.get("text"),
          c.get("subject"),
          c.get("predicate"),
          c.get("object"),
          d.status(),
          d.rationale());
      for (var e : evidence) {
        UUID sid = sourceIds.get(e.get("sourceId").toString());
        if (sid == null) throw new IllegalArgumentException("Unknown source");
        var source =
            sourceRows.stream()
                .filter(s -> s.get("id").equals(e.get("sourceId")))
                .findFirst()
                .orElseThrow();
        if (!source.get("text").toString().contains(e.get("excerpt").toString())
            || !e.get("excerpt").toString().contains(c.get("text").toString()))
          throw new IllegalArgumentException("Citation integrity failure");
        db.update(
            "INSERT INTO claim_evidence(id,claim_id,source_id,excerpt,stance) VALUES(?,?,?,?,?)",
            UUID.randomUUID(),
            cid,
            sid,
            e.get("excerpt"),
            e.get("stance"));
      }
      claimIds.add(cid.toString());
      publishedClaimIds.put(c.get("id").toString(), cid.toString());
      if (d.status().equals("VERIFIED"))
        db.update("UPDATE claims SET last_verified_at=now() WHERE id=?", cid);
      if (summary.isEmpty()) summary = c.get("text").toString();
    }
    if (claimIds.isEmpty() || !decisions.isEmpty())
      throw new IllegalArgumentException("Select known claims");
    List<Map<String, Object>> sections = new ArrayList<>();
    var draft = (Map<String, Object>) job.get("draft");
    if (Boolean.TRUE.equals(body.acceptGeneratedText())
        && draft != null
        && draft.get("content") instanceof Map<?, ?> draftContent
        && draftContent.get("sections") instanceof List<?> proposals) {
      for (Object item : proposals)
        if (item instanceof Map<?, ?> proposal
            && proposal.get("claims") instanceof List<?> cited
            && !cited.isEmpty()
            && cited.stream().allMatch(c -> publishedClaimIds.containsKey(c.toString()))) {
          String text = Objects.toString(proposal.get("explanation"), "");
          if (text.length() > 4000 || Objects.toString(proposal.get("title"), "").length() > 160)
            throw new IllegalArgumentException();
          sections.add(
              Map.of(
                  "id",
                  "section-" + (sections.size() + 1),
                  "title",
                  Objects.toString(proposal.get("title"), "Research notes"),
                  "claims",
                  cited.stream().map(c -> publishedClaimIds.get(c.toString())).toList(),
                  "explanation",
                  text,
                  "reviewed",
                  true));
        }
    }
    if (sections.isEmpty())
      sections.add(Map.of("id", "overview", "title", "Research notes", "claims", claimIds));
    else {
      var used = new HashSet<String>();
      for (var section : sections) used.addAll((List<String>) section.get("claims"));
      var remaining = claimIds.stream().filter(c -> !used.contains(c)).toList();
      if (!remaining.isEmpty())
        sections.add(
            Map.of("id", "further-evidence", "title", "Further evidence", "claims", remaining));
    }
    content.put("sections", sections);
    for (var section : sections)
      for (String claimId : (List<String>) section.get("claims"))
        db.update(
            "INSERT INTO citations(id,article_id,claim_id,section_id) VALUES(?,?,?,?)",
            UUID.randomUUID(),
            aid,
            UUID.fromString(claimId),
            section.get("id"));
    db.update(
        "UPDATE articles SET summary=?,content=?::jsonb WHERE id=?",
        summary,
        Json.write(content),
        aid);
    articles.revision(
        aid, content, "Human-reviewed research publication", (UUID) user(email).get("id"));
    articles.outbox(aid);
    db.update(
        "UPDATE research_jobs SET state='APPROVED',article_id=?,lease_until=NULL,updated_at=now()"
            + " WHERE id=?",
        aid,
        jobId);
    db.update(
        "INSERT INTO review_records(id,job_id,article_id,reviewer_id,decision,notes)"
            + " VALUES(?,?,?,?,'APPROVED',?)",
        UUID.randomUUID(),
        jobId,
        aid,
        user(email).get("id"),
        body.notes());
    db.update(
        "INSERT INTO audit_logs(actor_id,action,target_id) VALUES(?,'RESEARCH_APPROVED',?)",
        user(email).get("id"),
        jobId);
    event(jobId, "APPROVED", "Published after human review; graph and vector indexing pending");
    afterCommit(search::rebuild);
    return articles.article(slug);
  }

  private void afterCommit(Runnable action) {
    if (org.springframework.transaction.support.TransactionSynchronizationManager
        .isActualTransactionActive())
      org.springframework.transaction.support.TransactionSynchronizationManager
          .registerSynchronization(
              new org.springframework.transaction.support.TransactionSynchronization() {
                @Override
                public void afterCommit() {
                  action.run();
                }
              });
    else action.run();
  }
}
