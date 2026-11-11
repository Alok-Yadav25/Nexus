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
@RequestMapping("/api/v1/entities")
public class ExternalKnowledgeController {
 private final Db db;private final RestClient client;
 public ExternalKnowledgeController(Db db,@Value("${nexus.ai-url}")String url,@Value("${nexus.service-token}")String token){
  this.db=db;var factory=new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build());factory.setReadTimeout(Duration.ofSeconds(55));client=RestClient.builder().baseUrl(url).requestFactory(factory).defaultHeader("X-Service-Token",token).build();
 }
 @GetMapping("/resolve") @SuppressWarnings("unchecked")
 public Object resolve(@RequestParam String q){
  String query=q.strip();if(query.length()<2||query.length()>240)throw new IllegalArgumentException();
  String key=query.toLowerCase(Locale.ROOT);var existing=db.rows("SELECT payload FROM external_records WHERE provider='registry' AND external_id=? AND kind='resolution' AND expires_at>now()",key);
  if(!existing.isEmpty())return existing.getFirst().get("payload");
  try{Map<String,Object> payload=client.get().uri(b->b.path("/entities/resolve").queryParam("q",query).build()).retrieve().body(Map.class);
   if(payload==null||!payload.containsKey("candidates"))throw new IllegalArgumentException();
   db.update("INSERT INTO external_records(id,provider,external_id,kind,payload,expires_at) VALUES(?,'registry',?,'resolution',?::jsonb,now()+interval '1 hour') ON CONFLICT(provider,external_id,kind) DO UPDATE SET payload=excluded.payload,retrieved_at=now(),expires_at=excluded.expires_at",UUID.randomUUID(),key,Json.write(payload));return payload;
  }catch(Exception unavailable){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"External discovery is temporarily unavailable. The local library remains available.");}
 }
}
