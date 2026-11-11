package com.nexus.search;

import com.nexus.common.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class SearchService {
  private final Db db;
  private final StringRedisTemplate redis;
  private volatile RadixTrie trie = new RadixTrie();
  private volatile long cacheGeneration = System.currentTimeMillis();
  private final RestClient ai;
  private final RestClient qdrant;
  private final int rrfK;
  private final double minVectorScore;

  public SearchService(
      Db db,
      StringRedisTemplate redis,
      @Value("${nexus.ai-url}") String aiUrl,
      @Value("${nexus.qdrant-url}") String qUrl,
      @Value("${nexus.service-token}") String token,
      @Value("${nexus.rrf-k:60}") int rrfK,
      @Value("${nexus.vector-min-score:0.55}") double minVectorScore) {
    this.db = db;
    this.rrfK = rrfK;
    this.minVectorScore = minVectorScore;
    this.redis = redis;
    var factory =
        new org.springframework.http.client.JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(3))
                .build());
    factory.setReadTimeout(Duration.ofSeconds(4));
    ai =
        RestClient.builder()
            .baseUrl(aiUrl)
            .requestFactory(factory)
            .defaultHeader("X-Service-Token", token)
            .build();
    qdrant = RestClient.builder().baseUrl(qUrl).requestFactory(factory).build();
  }

  @Scheduled(initialDelayString = "${nexus.worker-initial-delay:10000}", fixedDelay = 60000)
  public void rebuild() {
    var next = new RadixTrie();
    for (var row :
        db.rows(
            "SELECT e.id,e.name,e.slug,al.alias,(SELECT count(*) FROM search_logs s WHERE"
                + " lower(s.query)=lower(e.name)) AS popularity FROM entities e JOIN articles a ON"
                + " a.entity_id=e.id AND a.status='PUBLISHED' LEFT JOIN entity_aliases al ON"
                + " al.entity_id=e.id")) {
      var entry =
          new RadixTrie.Entry(
              row.get("id").toString(),
              row.get("name").toString(),
              row.get("slug").toString(),
              ((Number) row.get("popularity")).longValue());
      next.insert(entry.name(), entry);
      if (row.get("alias") != null) next.insert(row.get("alias").toString(), entry);
    }
    trie = next;
    cacheGeneration++;
  }

  public List<Map<String, Object>> suggestions(String query) {
    String normalized = RadixTrie.normalize(query);
    if (normalized.isBlank()) return List.of();
    String key = "suggest:v1:" + cacheGeneration + ":" + normalized;
    try {
      String cached = redis.opsForValue().get(key);
      if (cached != null) return Json.rows(cached);
    } catch (Exception ignored) {
    }
    var found =
        trie.prefix(normalized, 8).stream()
            .map(e -> Map.<String, Object>of("id", e.id(), "name", e.name(), "slug", e.slug()))
            .toList();
    try {
      redis.opsForValue().set(key, Json.write(found), Duration.ofSeconds(30));
    } catch (Exception ignored) {
    }
    return found;
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> search(String query) {
    String q = RadixTrie.normalize(query);
    if (q.length() < 2 || q.length() > 240) throw new IllegalArgumentException();
    long start = System.nanoTime();
    Map<String, Map<String, Object>> docs = new LinkedHashMap<>();
    Map<String, List<String>> rankings = new LinkedHashMap<>();
    var exact =
        db.rows(
            "SELECT DISTINCT a.id,a.slug,a.title,a.summary,e.domain,e.ontology FROM articles a JOIN"
                + " entities e ON e.id=a.entity_id LEFT JOIN entity_aliases al ON al.entity_id=e.id"
                + " WHERE a.status='PUBLISHED' AND (lower(a.title)=? OR lower(e.name)=? OR"
                + " al.normalized=?)",
            q,
            q,
            q);
    add(exact, docs, rankings, "Exact title or alias");
    var lexical =
        db.rows(
            "SELECT a.id,a.slug,a.title,a.summary,e.domain,e.ontology FROM articles a JOIN entities"
                + " e ON e.id=a.entity_id WHERE a.status='PUBLISHED' AND (a.search_document @@"
                + " websearch_to_tsquery('english',?) OR a.title ILIKE ?) ORDER BY"
                + " ts_rank_cd(a.search_document,websearch_to_tsquery('english',?)) DESC,a.title"
                + " LIMIT 40",
            q,
            "%" + q.replace("%", "\\%").replace("_", "\\_") + "%",
            q);
    add(lexical, docs, rankings, "PostgreSQL full-text");
    String vectorStatus = "UNAVAILABLE";
    try {
      qdrant.get().uri("/collections/article_chunks").retrieve().toBodilessEntity();
      Map<String, Object> embed =
          ai.post().uri("/embed").body(Map.of("texts", List.of(q))).retrieve().body(Map.class);
      var vectors = (List<?>) embed.get("vectors");
      Map<String, Object> response =
          qdrant
              .post()
              .uri("/collections/article_chunks/points/query")
              .body(
                  Map.of(
                      "query",
                      vectors.getFirst(),
                      "limit",
                      30,
                      "with_payload",
                      true,
                      "score_threshold",
                      minVectorScore,
                      "filter",
                      Map.of(
                          "must",
                          List.of(
                              Map.of(
                                  "key",
                                  "publication_status",
                                  "match",
                                  Map.of("value", "PUBLISHED")),
                              Map.of(
                                  "key",
                                  "embedding_model",
                                  "match",
                                  Map.of("value", embed.get("model")))))))
              .retrieve()
              .body(Map.class);
      Map<String, Object> result = (Map<String, Object>) response.get("result");
      var points = (List<Map<String, Object>>) result.get("points");
      var vectorDocs = new ArrayList<Map<String, Object>>();
      for (var point : points) {
        var payload = (Map<String, Object>) point.get("payload");
        var rows =
            db.rows(
                "SELECT a.id,a.slug,a.title,a.summary,e.domain,e.ontology FROM articles a JOIN"
                    + " entities e ON e.id=a.entity_id WHERE a.id=? AND a.status='PUBLISHED' AND"
                    + " a.version=?",
                UUID.fromString(payload.get("article_id").toString()),
                payload.get("version"));
        vectorDocs.addAll(rows);
      }
      add(vectorDocs, docs, rankings, "Semantic similarity");
      vectorStatus = "AVAILABLE";
    } catch (Exception ignored) {
    }
    var items =
        ReciprocalRankFusion.rank(rankings, rrfK).stream()
            .limit(40)
            .map(
                r -> {
                  var item = new LinkedHashMap<>(docs.get(r.id()));
                  item.put("score", r.score());
                  item.put("reasons", r.reasons());
                  return item;
                })
            .toList();
    long ms = (System.nanoTime() - start) / 1000000;
    db.update(
        "INSERT INTO search_logs(query,result_count,latency_ms) VALUES(?,?,?)",
        q,
        items.size(),
        ms);
    String classification =
        !exact.isEmpty()
            ? "EXISTING_ARTICLE"
            : items.isEmpty()
                ? (q.contains("?") ? "RESEARCH_QUESTION" : "UNINDEXED_OR_AMBIGUOUS")
                : "RELATED_KNOWLEDGE";
    return Map.of(
        "query",
        query,
        "items",
        items,
        "classification",
        classification,
        "vectorStatus",
        vectorStatus,
        "latencyMs",
        ms,
        "researchSuggested",
        items.isEmpty());
  }

  private void add(
      List<Map<String, Object>> rows,
      Map<String, Map<String, Object>> docs,
      Map<String, List<String>> rankings,
      String reason) {
    List<String> ids = new ArrayList<>();
    for (var r : rows) {
      String id = r.get("id").toString();
      docs.putIfAbsent(id, r);
      ids.add(id);
    }
    rankings.put(reason, ids);
  }
}
