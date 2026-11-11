package com.nexus.search;

import com.nexus.common.Db;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {
  private final SearchService service;
  private final Db db;

  public SearchController(SearchService service, Db db) {
    this.service = service;
    this.db = db;
  }

  @GetMapping
  public Object search(@RequestParam String q) {
    return service.search(q);
  }

  @GetMapping("/suggestions")
  public Object suggestions(@RequestParam String q) {
    if (q.length() > 240) throw new IllegalArgumentException();
    return service.suggestions(q);
  }

  @GetMapping("/trending")
  public Object trending() {
    return db.rows(
        "SELECT query,count(*) AS searches FROM search_logs WHERE created_at>now()-interval '7"
            + " days' GROUP BY query ORDER BY count(*) DESC,query LIMIT 8");
  }
}
