package com.nexus;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.nexus.common.Db;
import com.nexus.learning.EncyclopediaController;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.web.server.ResponseStatusException;

class EncyclopediaControllerTest {
  HttpServer server;
  Db db;
  EncyclopediaController controller;
  AtomicInteger calls;
  String response;
  int status;

  @BeforeEach
  void setup() throws Exception {
    db = mock(Db.class);
    when(db.rows(anyString(), any(), any())).thenReturn(List.of());
    calls = new AtomicInteger();
    status = 200;
    response = "{\"items\":[{\"title\":\"Granite\"}],\"nextOffset\":12}";
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/encyclopedia",
        exchange -> {
          calls.incrementAndGet();
          assertEquals(
              "test-internal-token", exchange.getRequestHeaders().getFirst("X-Service-Token"));
          byte[] body = response.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, body.length);
          try (var out = exchange.getResponseBody()) {
            out.write(body);
          }
        });
    server.start();
    controller =
        new EncyclopediaController(
            db, "http://127.0.0.1:" + server.getAddress().getPort(), "test-internal-token");
  }

  @AfterEach
  void close() {
    server.stop(0);
  }

  @Test
  void publicSearchPassesProviderPaginationAndPersistsSeparateCache() {
    var value = (Map<?, ?>) controller.search("Granite", 0);
    assertEquals(12, value.get("nextOffset"));
    assertEquals(1, calls.get());
    verify(db).update(contains("wikipedia-live"), any(), any(), eq("search"), contains("Granite"));
  }

  @Test
  void freshCacheDoesNotCallProvider() {
    var payload = Map.of("items", List.of(Map.of("title", "Breaking Bad")));
    when(db.rows(anyString(), any(), any()))
        .thenReturn(List.of(Map.of("payload", payload, "fresh", true)));
    assertEquals(payload, controller.search("Breaking Bad", 0));
    assertEquals(0, calls.get());
  }

  @Test
  void staleCachePreservesAttributionAndOriginalRetrievalTime() {
    var payload =
        Map.of(
            "content",
            List.of("Saved article"),
            "retrievedAt",
            "2026-11-01T00:00:00Z",
            "attribution",
            "Wikipedia contributors");
    when(db.rows(anyString(), any(), any()))
        .thenReturn(List.of(Map.of("payload", payload, "fresh", false)));
    status = 503;
    var result = (Map<?, ?>) controller.article("Quartz");
    assertEquals(true, result.get("stale"));
    assertEquals(payload.get("retrievedAt"), result.get("retrievedAt"));
    assertEquals(payload.get("attribution"), result.get("attribution"));
  }

  @Test
  void notFoundAndOutageRemainDifferent() {
    status = 404;
    assertEquals(
        404,
        assertThrows(ResponseStatusException.class, () -> controller.article("Missing page"))
            .getStatusCode()
            .value());
    status = 503;
    assertEquals(
        503,
        assertThrows(ResponseStatusException.class, () -> controller.search("Quartz", 0))
            .getStatusCode()
            .value());
  }

  @Test
  void cacheWriteFailureDoesNotHideSuccessfulLiveResults() {
    when(db.update(anyString(), any(), any(), any(), any()))
        .thenThrow(new IllegalStateException("Cache disk unavailable"));
    var result = (Map<?, ?>) controller.search("Granite", 0);
    assertEquals(12, result.get("nextOffset"));
  }

  @Test
  void cacheReadFailureStillAllowsLiveRetrieval() {
    when(db.rows(anyString(), any(), any()))
        .thenThrow(new IllegalStateException("Cache unavailable"));
    assertEquals(12, ((Map<?, ?>) controller.search("Granite", 0)).get("nextOffset"));
  }

  @Test
  void invalidRequestsDoNotReachProvider() {
    assertThrows(IllegalArgumentException.class, () -> controller.search(" ", 0));
    assertThrows(IllegalArgumentException.class, () -> controller.search("Granite", -1));
    assertThrows(
        IllegalArgumentException.class, () -> controller.topics("Minerals", "https://evil.test"));
    assertEquals(0, calls.get());
  }
}
