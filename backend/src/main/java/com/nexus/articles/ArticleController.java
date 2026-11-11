package com.nexus.articles;

import com.nexus.common.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ArticleController {
  private final ArticleService service;
  private final Db db;

  public ArticleController(ArticleService service, Db db) {
    this.service = service;
    this.db = db;
  }

  @GetMapping("/articles")
  public Map<String, Object> articles(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "24") int size,
      @RequestParam(defaultValue = "") String domain,
      @RequestParam(defaultValue = "recent") String sort,
      @RequestParam(defaultValue = "") String q) {
    return Map.of(
        "items",
        service.list(page, size, domain, sort, q),
        "page",
        Math.max(0, page),
        "size",
        Math.clamp(size, 1, 60),
        "total",
        db.jdbc.queryForObject(
            "SELECT count(*) FROM articles a JOIN entities e ON e.id=a.entity_id WHERE"
                + " a.status='PUBLISHED' AND (?='' OR e.domain=?) AND (?='' OR a.title ILIKE ?)",
            Long.class,
            domain,
            domain,
            q,
            "%"+q+"%"));
  }

  @GetMapping("/sitemap/articles")
  public Object sitemap(@RequestParam(defaultValue="0") int page) {
    return db.rows("SELECT slug,updated_at FROM articles WHERE status='PUBLISHED' ORDER BY slug LIMIT 1000 OFFSET ?",Math.max(0L,(long)page)*1000);
  }

  @GetMapping("/articles/{slug}")
  public Map<String, Object> article(@PathVariable String slug) {
    return service.article(slug);
  }

  @GetMapping("/evidence/{id}")
  public Map<String, Object> evidence(@PathVariable UUID id) {
    return service.evidence(id);
  }

  @GetMapping("/evidence/{id}/sources")
  public Object evidenceSources(@PathVariable UUID id) {
    return service.evidence(id).get("sources");
  }

  @GetMapping("/articles/{id}/sources")
  public Object sources(@PathVariable UUID id) {
    return service
        .article(db.one("SELECT slug FROM articles WHERE id=?", id).get("slug").toString())
        .get("sources");
  }

  @GetMapping("/articles/{id}/citations")
  public Object citations(@PathVariable UUID id) {
    return service
        .article(db.one("SELECT slug FROM articles WHERE id=?", id).get("slug").toString())
        .get("citations");
  }

  @GetMapping("/articles/{id}/related")
  public Object related(@PathVariable UUID id) {
    return db.rows(
        "SELECT DISTINCT a.slug,a.title,a.summary,e.domain,e.ontology FROM articles a JOIN entities"
            + " e ON e.id=a.entity_id JOIN relationships r ON (r.from_entity=e.id OR"
            + " r.to_entity=e.id) WHERE a.id<>? AND a.status='PUBLISHED' AND (r.from_entity=(SELECT"
            + " entity_id FROM articles WHERE id=?) OR r.to_entity=(SELECT entity_id FROM articles"
            + " WHERE id=?)) LIMIT 12",
        id,
        id,
        id);
  }

  public record Edit(
      @Min(1) int version,
      @NotNull Map<String, Object> content,
      @NotBlank @Size(max = 500) String summary) {}

  @PutMapping("/articles/{id}")
  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  public Map<String, Object> update(
      @PathVariable UUID id, @Valid @RequestBody Edit body, Authentication auth) {
    return service.update(
        id,
        body.version(),
        body.content(),
        body.summary(),
        (UUID) db.one("SELECT id FROM users WHERE email=?", auth.getName()).get("id"));
  }

  @GetMapping("/stats")
  public Map<String, Object> stats() {
    return Map.of(
        "articles",
        db.jdbc.queryForObject(
            "SELECT count(*) FROM articles WHERE status='PUBLISHED'", Long.class),
        "entities",
        db.count("entities"),
        "relationships",
        db.count("relationships"),
        "sources",
        db.count("sources"),
        "claims",
        db.count("claims"),
        "domains",
        db.rows(
            "SELECT domain,count(*) AS count FROM entities GROUP BY domain ORDER BY count(*)"
                + " DESC"));
  }
}
