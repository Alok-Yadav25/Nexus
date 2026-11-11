package com.nexus.research;

import com.nexus.common.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/research")
@PreAuthorize("isAuthenticated()")
public class ResearchController {
  private final ResearchService service;
  private final Db db;

  public ResearchController(ResearchService service, Db db) {
    this.service = service;
    this.db = db;
  }

  public record Request(
      @NotBlank @Size(min = 2, max = 240) String topic,
      @NotBlank String ontology,
      @Size(max = 100) String canonicalId) {}

  @PostMapping
  public Object create(@Valid @RequestBody Request body, Authentication auth) {
    return service.create(body.topic(), body.ontology(), auth.getName(), body.canonicalId());
  }

  @GetMapping
  public Object list(Authentication auth) {
    var u = service.user(auth.getName());
    return db.rows(
        "SELECT id,topic,state,error,created_at,updated_at FROM research_jobs WHERE requested_by=?"
            + " ORDER BY created_at DESC LIMIT 100",
        u.get("id"));
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable UUID id, Authentication auth) {
    return service.get(id, auth.getName());
  }

  @SuppressWarnings("unchecked")
  @GetMapping("/{id}/{kind:sources|claims}")
  public Object detail(@PathVariable UUID id, @PathVariable String kind, Authentication auth) {
    return ((Map<String, Object>) service.get(id, auth.getName()).get("checkpoint"))
        .getOrDefault(kind, List.of());
  }

  @PostMapping("/{id}/cancel")
  public Object cancel(@PathVariable UUID id, Authentication auth) {
    service.get(id, auth.getName());
    db.update(
        "UPDATE research_jobs SET state='CANCELLED',updated_at=now() WHERE id=? AND state NOT IN"
            + " ('APPROVED','PUBLISHED')",
        id);
    service.event(id, "CANCELLED", "Cancelled by user");
    return service.get(id, auth.getName());
  }

  @PostMapping("/{id}/retry")
  public Object retry(@PathVariable UUID id, Authentication auth) {
    service.get(id, auth.getName());
    db.update(
        "UPDATE research_jobs SET state='RETRYING',attempts=0,lease_until=NULL,error=NULL WHERE"
            + " id=? AND state='FAILED'",
        id);
    service.event(id, "RETRYING", "Retry requested from last checkpoint");
    return service.get(id, auth.getName());
  }

  @PostMapping("/{id}/approve")
  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  public Object approve(
      @PathVariable UUID id, @RequestBody ResearchService.Approval body, Authentication auth) {
    return service.approve(id, body, auth.getName());
  }

  public record Note(@NotBlank @Size(min = 12, max = 2000) String notes) {}

  @PostMapping("/{id}/reject")
  @PreAuthorize("hasAnyRole('ADMIN','REVIEWER')")
  public Object reject(@PathVariable UUID id, @Valid @RequestBody Note note, Authentication auth) {
    service.get(id, auth.getName());
    int changed =
        db.update(
            "UPDATE research_jobs SET state='REJECTED',updated_at=now() WHERE id=? AND"
                + " state='REVIEW_REQUIRED'",
            id);
    if (changed == 0) throw new IllegalArgumentException();
    db.update(
        "INSERT INTO review_records(id,job_id,reviewer_id,decision,notes)"
            + " VALUES(?,?,?,'REJECTED',?)",
        UUID.randomUUID(),
        id,
        service.user(auth.getName()).get("id"),
        note.notes());
    service.event(id, "REJECTED", note.notes());
    return Map.of("state", "REJECTED");
  }

  @GetMapping(value = "/{id}/stream", produces = "text/event-stream")
  public SseEmitter stream(
      @PathVariable UUID id,
      Authentication auth,
      @RequestHeader(value = "Last-Event-ID", defaultValue = "0") long lastId) {
    service.get(id, auth.getName());
    var emitter = new SseEmitter(60000L);
    String email = auth.getName();
    Thread.ofVirtual()
        .start(
            () -> {
              long cursor = lastId;
              try {
                for (int i = 0; i < 50; i++) {
                  for (var event :
                      db.rows(
                          "SELECT * FROM research_job_events WHERE job_id=? AND id>? ORDER BY id",
                          id,
                          cursor)) {
                    cursor = ((Number) event.get("id")).longValue();
                    emitter.send(
                        SseEmitter.event().id(Long.toString(cursor)).name("stage").data(event));
                  }
                  emitter.send(SseEmitter.event().comment("heartbeat"));
                  String state = service.get(id, email).get("state").toString();
                  if (Set.of("REVIEW_REQUIRED", "PUBLISHED", "FAILED", "CANCELLED", "REJECTED")
                      .contains(state)) break;
                  Thread.sleep(1000);
                }
                emitter.complete();
              } catch (Exception e) {
                emitter.completeWithError(e);
              }
            });
    return emitter;
  }
}
