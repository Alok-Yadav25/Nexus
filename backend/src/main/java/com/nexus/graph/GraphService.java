package com.nexus.graph;

import com.nexus.common.*;
import java.util.*;
import org.neo4j.driver.*;
import org.springframework.stereotype.Service;

@Service
public class GraphService {
  public static final Set<String> TYPES =
      Set.of(
          "RELATED_TO",
          "PART_OF",
          "DISCOVERED_BY",
          "DEVELOPED_BY",
          "USED_IN",
          "LOCATED_IN",
          "CAUSED_BY",
          "DERIVED_FROM",
          "BASED_ON",
          "BELONGS_TO",
          "INFLUENCES",
          "PRECEDES",
          "SUPPORTS",
          "CONTRADICTS",
          "SIMILAR_TO",
          "COMPARED_WITH");
  private final Db db;
  private final Driver driver;

  public GraphService(Db db, Driver driver) {
    this.db = db;
    this.driver = driver;
  }

  public Map<String, Object> explore(int limit) {
    int bounded = Math.clamp(limit, 1, 150);
    var nodes =
        db.rows(
            "SELECT e.*,a.title,a.slug AS article_slug,(SELECT count(*) FROM relationships r WHERE"
                + " r.from_entity=e.id OR r.to_entity=e.id) AS degree FROM entities e LEFT JOIN"
                + " articles a ON a.entity_id=e.id AND a.status='PUBLISHED' ORDER BY degree"
                + " DESC,e.name LIMIT ?",
            bounded);
    var ids = new HashSet<>(nodes.stream().map(n -> n.get("id").toString()).toList());
    var edges =
        db
            .rows(
                "SELECT r.*,c.text AS explanation FROM relationships r JOIN claims c ON"
                    + " c.id=r.claim_id WHERE r.status IN"
                    + " ('VERIFIED','FICTIONAL_CANON','THEORETICAL_MODEL') ORDER BY r.id LIMIT"
                    + " 1000")
            .stream()
            .filter(
                e ->
                    ids.contains(e.get("from_entity").toString())
                        && ids.contains(e.get("to_entity").toString()))
            .toList();
    return Map.of("nodes", nodes, "edges", edges, "source", "POSTGRES_CANONICAL", "limit", bounded);
  }

  public Map<String, Object> entity(UUID id, int depth) {
    return traverse(id, Math.clamp(depth, 1, 3), false);
  }

  private Map<String, Object> traverse(UUID id, int bounded, boolean verifiedOnly) {
    var root = db.one("SELECT * FROM entities WHERE id=?", id);
    // Traverse indexed adjacency from this entity, never a global popularity page.
    var reached = new LinkedHashSet<UUID>();
    reached.add(id);
    var frontier = new LinkedHashSet<UUID>();
    frontier.add(id);
    var edgesById = new LinkedHashMap<String, Map<String, Object>>();
    boolean truncated = false;
    for (int step = 0; step < bounded && !frontier.isEmpty(); step++) {
      var next = new LinkedHashSet<UUID>();
      for (UUID node : frontier) {
        var adjacent =
            db.rows(
                "SELECT r.*,c.text AS explanation FROM relationships r JOIN claims c ON"
                    + " c.id=r.claim_id WHERE (r.from_entity=? OR r.to_entity=?) AND "
                    + (verifiedOnly
                        ? "r.status='VERIFIED'"
                        : "r.status IN ('VERIFIED','FICTIONAL_CANON','THEORETICAL_MODEL')")
                    + " ORDER BY r.id LIMIT 201",
                node,
                node);
        if (adjacent.size() > 200) truncated = true;
        for (var edge : adjacent.stream().limit(200).toList()) {
          UUID a = (UUID) edge.get("from_entity"), b = (UUID) edge.get("to_entity");
          UUID other = a.equals(node) ? b : a;
          if (!reached.contains(other) && reached.size() >= 500) {
            truncated = true;
            continue;
          }
          edgesById.put(edge.get("id").toString(), edge);
          if (reached.add(other)) next.add(other);
        }
      }
      frontier = next;
    }
    var nodes = new ArrayList<Map<String, Object>>();
    for (UUID node : reached)
      nodes.add(
          db.one(
              "SELECT e.*,a.slug AS article_slug FROM entities e LEFT JOIN articles a ON"
                  + " a.entity_id=e.id AND a.status='PUBLISHED' WHERE e.id=?",
              node));
    return Map.of(
        "entity",
        root,
        "nodes",
        nodes,
        "edges",
        new ArrayList<>(edgesById.values()),
        "source",
        "POSTGRES_CANONICAL",
        "depth",
        bounded,
        "complete",
        !truncated,
        "limits",
        Map.of("nodes", 500, "edgesPerNode", 200));
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> cast(Object o) {
    return (List<Map<String, Object>>) o;
  }

  public Map<String, Object> path(UUID from, UUID to, int depth) {
    db.one("SELECT id FROM entities WHERE id=?", from);
    db.one("SELECT id FROM entities WHERE id=?", to);
    int bounded = Math.clamp(depth, 1, 6);
    try (var session = driver.session()) {
      var records =
          session
              .run(
                  "MATCH (a:Entity {id:$from}),(b:Entity {id:$to}) MATCH"
                      + " p=allShortestPaths((a)-[:LINK*1..6]-(b)) WHERE length(p)<=$depth AND"
                      + " all(r IN relationships(p) WHERE r.status='VERIFIED') RETURN [n IN"
                      + " nodes(p)|n.id] AS ids LIMIT 3",
                  Map.of("from", from.toString(), "to", to.toString(), "depth", bounded))
              .list();
      if (!records.isEmpty()) {
        var paths =
            records.stream()
                .map(r -> hydrate(r.get("ids").asList(org.neo4j.driver.Value::asString)))
                .toList();
        return Map.of("paths", paths, "source", "NEO4J", "maxDepth", bounded);
      }
    } catch (Exception ignored) {
    }
    // An explicitly identified fallback traverses canonical records when projection is unavailable.
    var graph = traverse(from, bounded, true);
    var edges =
        cast(graph.get("edges")).stream().filter(e -> e.get("status").equals("VERIFIED")).toList();
    Map<String, List<String>> adj = new HashMap<>();
    for (var e : edges) {
      String a = e.get("from_entity").toString(), b = e.get("to_entity").toString();
      adj.computeIfAbsent(a, x -> new ArrayList<>()).add(b);
      adj.computeIfAbsent(b, x -> new ArrayList<>()).add(a);
    }
    List<List<String>> queue = new ArrayList<>();
    queue.add(List.of(from.toString()));
    List<Map<String, Object>> paths = new ArrayList<>();
    int shortest = 99;
    for (int index = 0; index < queue.size() && index < 10000 && paths.size() < 3; index++) {
      var p = queue.get(index);
      if (p.size() - 1 > bounded || p.size() > shortest) continue;
      String last = p.getLast();
      if (last.equals(to.toString())) {
        shortest = p.size();
        paths.add(hydrate(p));
        continue;
      }
      for (String neighbor : adj.getOrDefault(last, List.of()))
        if (!p.contains(neighbor)) {
          var next = new ArrayList<>(p);
          next.add(neighbor);
          if (queue.size() < 10000) queue.add(next);
        }
    }
    return Map.of(
        "paths",
        paths,
        "source",
        "POSTGRES_CANONICAL_FALLBACK",
        "maxDepth",
        bounded,
        "complete",
        Boolean.TRUE.equals(graph.get("complete")) && queue.size() < 10000,
        "message",
        paths.isEmpty()
            ? "No verified path was found within the requested depth and traversal limits."
            : "Every link has a supporting claim. Traversal may follow a relationship in either"
                + " direction.");
  }

  private Map<String, Object> hydrate(List<String> ids) {
    List<Map<String, Object>> nodes = new ArrayList<>(), edges = new ArrayList<>();
    for (String id : ids)
      nodes.add(
          db.one(
              "SELECT e.*,a.slug AS article_slug FROM entities e LEFT JOIN articles a ON"
                  + " a.entity_id=e.id AND a.status='PUBLISHED' WHERE e.id=?",
              UUID.fromString(id)));
    for (int i = 1; i < ids.size(); i++)
      edges.add(
          db.one(
              "SELECT r.*,c.text AS explanation FROM relationships r JOIN claims c ON"
                  + " c.id=r.claim_id WHERE r.status='VERIFIED' AND ((from_entity=? AND"
                  + " to_entity=?) OR (from_entity=? AND to_entity=?))",
              UUID.fromString(ids.get(i - 1)),
              UUID.fromString(ids.get(i)),
              UUID.fromString(ids.get(i)),
              UUID.fromString(ids.get(i - 1))));
    return Map.of(
        "nodes", nodes, "edges", edges, "length", edges.size(), "evidenceStatus", "VERIFIED_LINKS");
  }

  public void project(UUID article) {
    var entity =
        db.one(
            "SELECT e.* FROM entities e JOIN articles a ON a.entity_id=e.id WHERE a.id=?", article);
    try (var session = driver.session()) {
      session
          .run("CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE")
          .consume();
      session.executeWrite(
          tx -> {
            tx.run(
                    "MERGE (e:Entity {id:$id}) SET"
                        + " e.name=$name,e.slug=$slug,e.ontology=$ontology,e.domain=$domain",
                    Map.of(
                        "id",
                        entity.get("id").toString(),
                        "name",
                        entity.get("name"),
                        "slug",
                        entity.get("slug"),
                        "ontology",
                        entity.get("ontology"),
                        "domain",
                        entity.get("domain")))
                .consume();
            for (var edge :
                db.rows(
                    "SELECT r.*,e1.name AS from_name,e2.name AS to_name FROM relationships r JOIN"
                        + " entities e1 ON e1.id=r.from_entity JOIN entities e2 ON"
                        + " e2.id=r.to_entity WHERE r.from_entity=? OR r.to_entity=?",
                    entity.get("id"),
                    entity.get("id"))) {
              if (!TYPES.contains(edge.get("type").toString()))
                throw new IllegalArgumentException("Unsupported relationship");
              tx.run(
                      "MERGE (a:Entity {id:$from}) SET a.name=$fromName MERGE (b:Entity {id:$to})"
                          + " SET b.name=$toName MERGE (a)-[r:LINK {id:$id}]->(b) SET"
                          + " r.type=$type,r.claimId=$claim,r.status=$status",
                      Map.of(
                          "id",
                          edge.get("id").toString(),
                          "from",
                          edge.get("from_entity").toString(),
                          "to",
                          edge.get("to_entity").toString(),
                          "fromName",
                          edge.get("from_name"),
                          "toName",
                          edge.get("to_name"),
                          "type",
                          edge.get("type"),
                          "claim",
                          edge.get("claim_id").toString(),
                          "status",
                          edge.get("status")))
                  .consume();
            }
            return null;
          });
    }
  }
}
