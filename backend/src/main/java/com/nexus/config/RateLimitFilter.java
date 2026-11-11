package com.nexus.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Authenticated accounts and server-signed browser identities avoid proxy-wide user quotas.
 * Forwarded IP headers are deliberately never trusted. A separate broad socket-peer ceiling
 * bounds anonymous cookie cycling; deploy an additional trusted edge network quota at scale. */
@Component
public class RateLimitFilter extends OncePerRequestFilter {
  private record Counter(long minute, int count) {}
  private final ConcurrentHashMap<String, Counter> counters = new ConcurrentHashMap<>();
  private final StringRedisTemplate redis;
  private final byte[] secret;
  private final boolean secure;
  private volatile long redisRetryAt;
  private static final DefaultRedisScript<Long> INCREMENT = new DefaultRedisScript<>(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n", Long.class);

  public RateLimitFilter(StringRedisTemplate redis,
      @Value("${nexus.rate-limit-secret}") String secret,
      @Value("${server.servlet.session.cookie.secure:true}") boolean secure) {
    this.redis = redis; this.secret = secret.getBytes(StandardCharsets.UTF_8); this.secure = secure;
  }
  private String sign(String input) {
    try { var mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret,"HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) { throw new IllegalStateException(e); }
  }
  String identity(HttpServletRequest req, HttpServletResponse res) {
    var session=req.getSession(false);
    if (session != null && session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY) instanceof SecurityContext context
        && context.getAuthentication()!=null && context.getAuthentication().isAuthenticated())
      return "user:"+sign(context.getAuthentication().getName());
    String value = Arrays.stream(Optional.ofNullable(req.getCookies()).orElse(new Cookie[0]))
        .filter(c->c.getName().equals("NEXUS_CLIENT")).map(Cookie::getValue).findFirst().orElse("");
    String[] pieces=value.split("\\.");
    if (pieces.length!=2 || !pieces[0].matches("[a-f0-9-]{36}") || !MessageDigest.isEqual(sign(pieces[0]).getBytes(StandardCharsets.UTF_8),pieces[1].getBytes(StandardCharsets.UTF_8))) {
      String id=UUID.randomUUID().toString(); value=id+"."+sign(id);
      var cookie=new Cookie("NEXUS_CLIENT",value);cookie.setHttpOnly(true);cookie.setSecure(secure);cookie.setPath("/");cookie.setMaxAge(86400*30);cookie.setAttribute("SameSite","Lax");res.addCookie(cookie);
    }
    return "browser:"+sign(value);
  }
  private long count(String key, long minute) {
    if (System.currentTimeMillis()>=redisRetryAt) try {
      Long n=redis.execute(INCREMENT,List.of("nexus:rate:"+minute+":"+key));
      if(n!=null)return n;
    } catch(Exception unavailable){redisRetryAt=System.currentTimeMillis()+5000;}
    if(counters.size()>20000)counters.entrySet().removeIf(e->e.getValue().minute()!=minute);
    return counters.compute(key,(k,v)->v==null||v.minute()!=minute?new Counter(minute,1):new Counter(minute,v.count()+1)).count();
  }
  @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException {
    String path=req.getRequestURI();
    if(!path.startsWith("/api/")){chain.doFilter(req,res);return;}
    long minute=System.currentTimeMillis()/60000;
    String bucket=path.equals("/api/v1/auth/login")?"login":path.equals("/api/v1/auth/register")?"register":path.contains("password")||path.contains("verification")?"recovery":path.equals("/api/v1/auth/csrf")?"csrf":path.startsWith("/api/v1/research")&&req.getMethod().equals("POST")?"research":"api";
    int max=switch(bucket){case "login"->15;case "register","recovery"->10;case "research"->20;case "csrf"->240;default->600;};
    String identity=identity(req,res);
    boolean rejected=count(identity+":"+bucket,minute)>max;
    if(identity.startsWith("browser:") && !Set.of("api","csrf").contains(bucket))
      rejected|=count("network:"+sign(req.getRemoteAddr())+":"+bucket,minute)>300;
    res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Request-ID",UUID.randomUUID().toString());
    if(rejected){res.setStatus(429);res.setHeader("Retry-After",Long.toString(60-System.currentTimeMillis()/1000%60));res.setContentType("application/json");res.getWriter().write("{\"error\":\"Request allowance reached; retry after the indicated delay\"}");return;}
    org.slf4j.MDC.put("requestId",res.getHeader("X-Request-ID"));
    try{chain.doFilter(req,res);}finally{org.slf4j.MDC.remove("requestId");}
  }
}
