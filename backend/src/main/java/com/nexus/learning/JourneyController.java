package com.nexus.learning;

import com.nexus.common.*;
import com.nexus.graph.GraphService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/journeys")
public class JourneyController {
  private final Db db;private final GraphService graph;
  public JourneyController(Db db,GraphService graph){this.db=db;this.graph=graph;}
  UUID user(Authentication a){return (UUID)db.one("SELECT id FROM users WHERE email=?",a.getName()).get("id");}
  @GetMapping @PreAuthorize("isAuthenticated()")
  public Object list(Authentication a){return db.rows("SELECT * FROM learning_journeys WHERE user_id=? ORDER BY updated_at DESC LIMIT 100",user(a));}
  @GetMapping("/{id}") @PreAuthorize("isAuthenticated()")
  public Map<String,Object> get(@PathVariable UUID id,Authentication a){return db.one("SELECT * FROM learning_journeys WHERE id=? AND user_id=?",id,user(a));}
  public record Create(@NotNull UUID from,@NotNull UUID to,@Pattern(regexp="BEGINNER|INTERMEDIATE|ADVANCED")String level){}
  @PostMapping @PreAuthorize("isAuthenticated()")
  @SuppressWarnings("unchecked")
  public Object create(@Valid @RequestBody Create body,Authentication a){
    var paths=(List<Map<String,Object>>)graph.path(body.from(),body.to(),6).get("paths");
    if(paths.isEmpty())throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,"No evidence-backed journey connects these concepts within the traversal bounds");
    var path=paths.getFirst();var nodes=(List<Map<String,Object>>)path.get("nodes");
    String title=nodes.getFirst().get("name")+" → "+nodes.getLast().get("name");
    return db.one("INSERT INTO learning_journeys(id,user_id,title,level,nodes) VALUES(?,?,?,?,?::jsonb) RETURNING *",UUID.randomUUID(),user(a),title,body.level()==null?"BEGINNER":body.level(),Json.write(path));
  }
  public record Progress(@NotNull UUID entity,@NotNull Boolean complete){}
  @PostMapping("/{id}/progress") @PreAuthorize("isAuthenticated()")
  @SuppressWarnings("unchecked")
  @org.springframework.transaction.annotation.Transactional
  public Object progress(@PathVariable UUID id,@Valid @RequestBody Progress body,Authentication a){
    var row=db.one("SELECT * FROM learning_journeys WHERE id=? AND user_id=? FOR UPDATE",id,user(a));
    var path=(Map<String,Object>)row.get("nodes");var nodes=(List<Map<String,Object>>)path.get("nodes");
    if(nodes.stream().noneMatch(n->n.get("id").toString().equals(body.entity().toString())))throw new IllegalArgumentException();
    var completed=new LinkedHashSet<>((List<String>)row.get("completed"));
    if(body.complete())completed.add(body.entity().toString());else completed.remove(body.entity().toString());
    db.update("UPDATE learning_journeys SET completed=?::jsonb,updated_at=now() WHERE id=?",Json.write(completed),id);
    return get(id,a);
  }
}
