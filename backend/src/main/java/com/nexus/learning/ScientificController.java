package com.nexus.learning;

import com.nexus.common.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/visuals")
public class ScientificController {
  private final Db db; private final RestClient client;
  public ScientificController(Db db,@Value("${nexus.ai-url}") String url,@Value("${nexus.service-token}")String token) {
    this.db=db;
    var factory=new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());factory.setReadTimeout(Duration.ofSeconds(55));
    client=RestClient.builder().baseUrl(url).requestFactory(factory).defaultHeader("X-Service-Token",token).build();
  }
  @GetMapping("/{kind}")
  @SuppressWarnings("unchecked")
  public Object model(@PathVariable String kind,@RequestParam String q) {
    if(!Set.of("planet","molecule").contains(kind))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No viewer registered for this data");
    String query=q.strip();if(query.isEmpty()||query.length()>240)throw new IllegalArgumentException();
    String key=query.toLowerCase(Locale.ROOT);
    var cached=db.rows("SELECT payload,expires_at>now() AS fresh FROM external_records WHERE provider='scientific' AND external_id=? AND kind=?",key,kind);
    if(!cached.isEmpty()&&Boolean.TRUE.equals(cached.getFirst().get("fresh")))return cached.getFirst().get("payload");
    try {
      Map<String,Object> payload=client.get().uri(b->b.path("/visuals/"+kind).queryParam("q",query).build()).retrieve().body(Map.class);
      if(payload==null||!kind.equals(payload.get("kind"))||!payload.containsKey("source"))throw new IllegalArgumentException();
      db.update("INSERT INTO external_records(id,provider,external_id,kind,payload,expires_at) VALUES(?,'scientific',?,?,?::jsonb,now()+interval '1 day') ON CONFLICT(provider,external_id,kind) DO UPDATE SET payload=excluded.payload,retrieved_at=now(),expires_at=excluded.expires_at",UUID.randomUUID(),key,kind,Json.write(payload));
      return payload;
    } catch(Exception unavailable) {
      if(!cached.isEmpty()) {var payload=new LinkedHashMap<>((Map<String,Object>)cached.getFirst().get("payload"));payload.put("stale",true);return payload;}
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"A complete source-backed model could not be retrieved. Try an exact scientific name or provider ID; no model was invented.");
    }
  }
}
