package com.nexus.graph;

import com.nexus.common.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DiscoveryController {
  private final GraphService graph;
  private final Db db;

  public DiscoveryController(GraphService graph, Db db) {
    this.graph = graph;
    this.db = db;
  }

  @GetMapping("/graph/explore")
  public Object explore(@RequestParam(defaultValue = "100") int limit) {
    return graph.explore(limit);
  }

  @GetMapping({"/graph/entity/{id}", "/graph/entity/{id}/neighbors"})
  public Object entity(@PathVariable UUID id, @RequestParam(defaultValue = "1") int depth) {
    return graph.entity(id, depth);
  }

  @GetMapping("/graph/domains")
  public Object domains() {
    return db.rows(
        "SELECT domain,count(*) AS count FROM entities GROUP BY domain ORDER BY count(*) DESC");
  }

  @GetMapping("/graph/path")
  public Object path(
      @RequestParam UUID from, @RequestParam UUID to, @RequestParam(defaultValue = "6") int depth) {
    return graph.path(from, to, depth);
  }

  @GetMapping("/timeline/{id}")
  public Object timeline(@PathVariable UUID id) {
    var entity = db.one("SELECT * FROM entities WHERE id=?", id);
    return Map.of(
        "entity",
        entity,
        "events",
        db.rows(
            "SELECT t.*,c.text AS claim,c.status,a.slug FROM timeline_events t JOIN claims c ON"
                + " c.id=t.claim_id JOIN articles a ON a.id=c.article_id WHERE t.entity_id=? AND"
                + " a.status='PUBLISHED' ORDER BY event_date",
            id));
  }

  @GetMapping("/discover/random")
  public Object random() {
    return db.one(
        "SELECT slug,title FROM articles WHERE status='PUBLISHED' ORDER BY random() LIMIT 1");
  }

  @GetMapping("/discover/trending")
  public Object trending() {
    return db.rows(
        "SELECT a.slug,a.title,a.summary,count(s.id) AS searches FROM articles a LEFT JOIN"
            + " search_logs s ON lower(s.query)=lower(a.title) AND s.created_at>now()-interval '7"
            + " days' WHERE a.status='PUBLISHED' GROUP BY a.id ORDER BY searches DESC,a.title LIMIT"
            + " 8");
  }

  @GetMapping("/discover/cross-domain")
  public Object crossDomain() {
    return db.rows(
        "SELECT r.id,r.type,r.claim_id,r.status,c.text AS explanation,e1.name AS from_name,e1.slug"
            + " AS from_slug,e1.domain AS from_domain,e2.name AS to_name,e2.slug AS"
            + " to_slug,e2.domain AS to_domain FROM relationships r JOIN entities e1 ON"
            + " e1.id=r.from_entity JOIN entities e2 ON e2.id=r.to_entity JOIN claims c ON"
            + " c.id=r.claim_id WHERE e1.domain<>e2.domain ORDER BY e1.name LIMIT 30");
  }

  public record Comparison(List<UUID> entities, List<String> dimensions) {}

  @SuppressWarnings("unchecked")
  @PostMapping("/compare")
  public Object compare(@RequestBody Comparison input) {
    if (input.entities() == null || input.entities().size() < 2 || input.entities().size() > 4)
      throw new IllegalArgumentException();
    List<Map<String, Object>> items = new ArrayList<>();
    Set<String> dimensions = new TreeSet<>();
    for (UUID id : input.entities()) {
      var row =
          db.one(
              "SELECT a.title,a.slug,a.summary,a.content,e.ontology,e.id AS entity_id FROM articles"
                  + " a JOIN entities e ON e.id=a.entity_id WHERE e.id=? AND a.status='PUBLISHED'",
              id);
      var content = (Map<String, Object>) row.get("content");
      var attrs = (Map<String, Object>) content.getOrDefault("attributes", Map.of());
      row.put("attributes", attrs);
      dimensions.addAll(attrs.keySet());
      row.remove("content");
      items.add(row);
    }
    if (input.dimensions() != null && !input.dimensions().isEmpty())
      dimensions.retainAll(input.dimensions());
    return Map.of(
        "items",
        items,
        "dimensions",
        dimensions,
        "missingDataLabel",
        "Not documented in indexed evidence");
  }
}
