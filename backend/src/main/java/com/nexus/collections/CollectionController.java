package com.nexus.collections;

import com.nexus.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("isAuthenticated()")
public class CollectionController {
  private final Db db;

  public CollectionController(Db db) {
    this.db = db;
  }

  private UUID user(Authentication a) {
    return (UUID) db.one("SELECT id FROM users WHERE email=?", a.getName()).get("id");
  }

  public record CollectionInput(
      @NotBlank @Size(max = 120) String name,
      @Size(max = 1000) String description,
      boolean publicMap) {}

  @GetMapping("/collections")
  public Object list(Authentication a) {
    return db.rows(
        "SELECT c.*,(SELECT count(*) FROM collection_items i WHERE i.collection_id=c.id) AS"
            + " item_count FROM collections c WHERE user_id=? ORDER BY created_at DESC",
        user(a));
  }

  @PostMapping("/collections")
  public Object create(@Valid @RequestBody CollectionInput body, Authentication a) {
    return db.one(
        "INSERT INTO collections(id,user_id,name,description,public) VALUES(?,?,?,?,?) RETURNING *",
        UUID.randomUUID(),
        user(a),
        body.name(),
        body.description() == null ? "" : body.description(),
        body.publicMap());
  }

  @GetMapping("/collections/{id}")
  public Object collection(@PathVariable UUID id, Authentication a) {
    var c =
        db.one("SELECT * FROM collections WHERE id=? AND (user_id=? OR public=true)", id, user(a));
    c.put(
        "items",
        db.rows(
            "SELECT a.id,a.slug,a.title,a.summary,e.domain,e.ontology FROM collection_items i JOIN"
                + " articles a ON a.id=i.article_id JOIN entities e ON e.id=a.entity_id WHERE"
                + " i.collection_id=? AND a.status='PUBLISHED' ORDER BY i.added_at DESC",
            id));
    return c;
  }

  public record Item(UUID articleId) {}

  @PostMapping("/collections/{id}/items")
  public Object add(@PathVariable UUID id, @RequestBody Item body, Authentication a) {
    db.one("SELECT id FROM collections WHERE id=? AND user_id=?", id, user(a));
    db.one("SELECT id FROM articles WHERE id=? AND status='PUBLISHED'", body.articleId());
    db.update(
        "INSERT INTO collection_items(collection_id,article_id) VALUES(?,?) ON CONFLICT DO NOTHING",
        id,
        body.articleId());
    return collection(id, a);
  }

  @DeleteMapping("/collections/{id}/items/{article}")
  public Object remove(@PathVariable UUID id, @PathVariable UUID article, Authentication a) {
    db.one("SELECT id FROM collections WHERE id=? AND user_id=?", id, user(a));
    db.update("DELETE FROM collection_items WHERE collection_id=? AND article_id=?", id, article);
    return collection(id, a);
  }

  @GetMapping("/dashboard")
  public Object dashboard(Authentication a) {
    UUID uid = user(a);
    return Map.of(
        "saved",
        db.rows(
            "SELECT a.id,a.slug,a.title,a.summary,e.domain,e.ontology FROM saved_articles s JOIN"
                + " articles a ON a.id=s.article_id JOIN entities e ON e.id=a.entity_id WHERE"
                + " s.user_id=? AND a.status='PUBLISHED' ORDER BY s.created_at DESC",
            uid),
        "collections",
        list(a),
        "jobs",
        db.rows(
            "SELECT id,topic,state,created_at FROM research_jobs WHERE requested_by=? ORDER BY"
                + " created_at DESC LIMIT 20",
            uid));
  }

  @GetMapping("/articles/{id}/saved")
  public Object saved(@PathVariable UUID id, Authentication a) {
    return Map.of("saved", db.jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM saved_articles WHERE user_id=? AND article_id=?)", Boolean.class, user(a), id));
  }

  @PostMapping("/articles/{id}/save")
  public Object save(@PathVariable UUID id, Authentication a) {
    db.one("SELECT id FROM articles WHERE id=? AND status='PUBLISHED'", id);
    db.update(
        "INSERT INTO saved_articles(user_id,article_id) VALUES(?,?) ON CONFLICT DO NOTHING",
        user(a),
        id);
    return Map.of("saved", true);
  }

  @DeleteMapping("/articles/{id}/save")
  public Object unsave(@PathVariable UUID id, Authentication a) {
    db.update("DELETE FROM saved_articles WHERE user_id=? AND article_id=?", user(a), id);
    return Map.of("saved", false);
  }
}
