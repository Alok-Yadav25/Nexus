package com.nexus.revisions;

import com.nexus.articles.ArticleService;
import com.nexus.common.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/articles/{id}")
public class RevisionController {
  private final Db db;
  private final ArticleService articles;

  public RevisionController(Db db, ArticleService articles) {
    this.db = db;
    this.articles = articles;
  }

  private void published(UUID id) {
    db.one("SELECT id FROM articles WHERE id=? AND status='PUBLISHED'", id);
  }

  @GetMapping("/revisions")
  public Object revisions(@PathVariable UUID id) {
    published(id);
    return db.rows(
        "SELECT r.id,r.number,r.summary,r.content_hash,r.created_at,CASE WHEN r.author_id IS NULL THEN 'Editorial team' ELSE 'Contributor' END AS author FROM"
            + " article_revisions r LEFT JOIN users u ON u.id=r.author_id WHERE r.article_id=?"
            + " ORDER BY r.number DESC",
        id);
  }

  @GetMapping("/compare")
  public Object compare(@PathVariable UUID id, @RequestParam int from, @RequestParam int to) {
    published(id);
    var a =
        db.one("SELECT content FROM article_revisions WHERE article_id=? AND number=?", id, from);
    var b = db.one("SELECT content FROM article_revisions WHERE article_id=? AND number=?", id, to);
    return Map.of(
        "from",
        a,
        "to",
        b,
        "edits",
        MyersDiff.diff(Json.pretty(a.get("content")), Json.pretty(b.get("content"))));
  }

  public record Restore(int number, int version) {}

  @SuppressWarnings("unchecked")
  @PostMapping("/restore")
  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  public Object restore(@PathVariable UUID id, @RequestBody Restore body, Authentication auth) {
    var content =
        (Map<String, Object>)
            db.one(
                    "SELECT content FROM article_revisions WHERE article_id=? AND number=?",
                    id,
                    body.number())
                .get("content");
    return articles.update(
        id,
        body.version(),
        content,
        "Restored revision " + body.number(),
        (UUID) db.one("SELECT id FROM users WHERE email=?", auth.getName()).get("id"));
  }
}
