package com.nexus.learning;

import com.nexus.common.Db;
import com.nexus.common.Json;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Live encyclopedia content is cached separately from reviewed NEXUS articles. */
@RestController
@RequestMapping("/api/v1/encyclopedia")
public class EncyclopediaController {
  private final Db db;
  private final RestClient client;

  public EncyclopediaController(
      Db db, @Value("${nexus.ai-url}") String url, @Value("${nexus.service-token}") String token) {
    this.db = db;
    var factory =
        new org.springframework.http.client.JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build());
    factory.setReadTimeout(Duration.ofSeconds(55));
    client =
        RestClient.builder()
            .baseUrl(url)
            .requestFactory(factory)
            .defaultHeader("X-Service-Token", token)
            .build();
  }

  @GetMapping("/search")
  public Object search(@RequestParam String q, @RequestParam(defaultValue = "0") int offset) {
    String query = text(q);
    if (offset < 0 || offset > 10000) throw new IllegalArgumentException("Invalid search page");
    return fetch("search", Map.of("q", query, "offset", String.valueOf(offset)), "items");
  }

  @GetMapping("/article")
  public Object article(@RequestParam String title) {
    return fetch("article", Map.of("title", text(title)), "content");
  }

  @GetMapping("/topics")
  public Object topics(
      @RequestParam(defaultValue = "Main topic classifications") String category,
      @RequestParam(defaultValue = "") String cursor) {
    if (cursor.length() > 2000 || !cursor.matches("[A-Za-z0-9_-]*"))
      throw new IllegalArgumentException("Invalid topic page");
    return fetch("topics", Map.of("category", text(category), "cursor", cursor), "items");
  }

  private static String text(String value) {
    String result = value.strip();
    if (result.isEmpty()
        || result.length() > 240
        || result.codePoints().anyMatch(Character::isISOControl))
      throw new IllegalArgumentException("Enter a topic of 1–240 characters");
    return result;
  }

  @SuppressWarnings("unchecked")
  private Object fetch(String kind, Map<String, String> params, String required) {
    String key;
    try {
      key =
          HexFormat.of()
              .formatHex(
                  MessageDigest.getInstance("SHA-256")
                      .digest(Json.write(params).getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
    List<Map<String, Object>> cached = List.of();
    try {
      cached =
          db.rows(
              "SELECT payload,expires_at>now() AS fresh FROM external_records WHERE"
                  + " provider='wikipedia-live' AND external_id=? AND kind=?",
              key,
              kind);
    } catch (RuntimeException cacheUnavailable) {
      /* Live retrieval can still succeed. */
    }
    if (!cached.isEmpty() && Boolean.TRUE.equals(cached.getFirst().get("fresh")))
      return cached.getFirst().get("payload");
    try {
      Map<String, Object> payload =
          client
              .get()
              .uri(
                  b -> {
                    b.path("/encyclopedia/" + kind);
                    params.forEach(b::queryParam);
                    return b.build();
                  })
              .retrieve()
              .body(Map.class);
      if (payload == null || !payload.containsKey(required)) throw new IllegalStateException();
      try {
        db.update(
            "INSERT INTO external_records(id,provider,external_id,kind,payload,expires_at)"
                + " VALUES(?,'wikipedia-live',?,?,?::jsonb,now()+interval '1 hour') ON"
                + " CONFLICT(provider,external_id,kind) DO UPDATE SET"
                + " payload=excluded.payload,retrieved_at=now(),expires_at=excluded.expires_at",
            UUID.randomUUID(),
            key,
            kind,
            Json.write(payload));
      } catch (RuntimeException cacheUnavailable) {
        /* Cache writes must not hide valid content. */
      }
      return payload;
    } catch (RestClientResponseException error) {
      if (error.getStatusCode().value() == 404)
        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND, "This Wikipedia article was not found. Try searching its title.");
      if (error.getStatusCode().value() == 422)
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid encyclopedia request");
    } catch (Exception unavailable) {
      // Preserve the original retrieval timestamp when showing an older cached copy.
    }
    if (!cached.isEmpty()) {
      Object value = cached.getFirst().get("payload");
      Map<String, Object> stale =
          value instanceof Map<?, ?>
              ? new LinkedHashMap<>((Map<String, Object>) value)
              : new LinkedHashMap<>(Json.map(value.toString()));
      stale.put("stale", true);
      return stale;
    }
    throw new ResponseStatusException(
        HttpStatus.SERVICE_UNAVAILABLE,
        "Wikipedia is temporarily unavailable. Please try again shortly; the NEXUS library is still"
            + " available below.");
  }
}
