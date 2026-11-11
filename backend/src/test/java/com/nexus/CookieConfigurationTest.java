package com.nexus;
import static org.junit.jupiter.api.Assertions.*;
import com.nexus.common.Json;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.*;
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"COOKIE_SECURE=true","nexus.worker-initial-delay=3600000","logging.level.root=WARN"})
class CookieConfigurationTest {
 static final EmbeddedPostgres PG;
 static{try{PG=EmbeddedPostgres.builder().start();}catch(Exception e){throw new ExceptionInInitializerError(e);}}
 @DynamicPropertySource static void properties(DynamicPropertyRegistry r){r.add("spring.datasource.url",()->PG.getJdbcUrl("postgres","postgres"));r.add("spring.datasource.username",()->"postgres");r.add("spring.datasource.password",()->"");}
 @AfterAll static void cleanup()throws Exception{PG.close();}
 @LocalServerPort int port;
 @Test void actualSessionCookiesAreSecureHttpOnlyAndSameSiteAfterSignIn()throws Exception{
  var client=HttpClient.newHttpClient();String base="http://127.0.0.1:"+port;
  var csrf=client.send(HttpRequest.newBuilder(URI.create(base+"/api/v1/auth/csrf")).GET().build(),HttpResponse.BodyHandlers.ofString());assertEquals(200,csrf.statusCode());
  var cookies=csrf.headers().allValues("set-cookie");
  String session=cookies.stream().filter(c->c.startsWith("JSESSIONID=")).findFirst().orElseThrow();assertAttributes(session);
  String cookieHeader=cookies.stream().map(c->c.split(";",2)[0]).collect(java.util.stream.Collectors.joining("; "));
  String body=Json.write(Map.of("email","cookie-"+UUID.randomUUID()+"@example.test","password","a-secure-cookie-test-password"));
  var login=client.send(HttpRequest.newBuilder(URI.create(base+"/api/v1/auth/register")).header("Cookie",cookieHeader).header("X-CSRF-TOKEN",Json.map(csrf.body()).get("token").toString()).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());assertEquals(200,login.statusCode());
  assertAttributes(login.headers().allValues("set-cookie").stream().filter(c->c.startsWith("JSESSIONID=")).findFirst().orElseThrow());
 }
 void assertAttributes(String cookie){String value=cookie.toLowerCase(Locale.ROOT);assertTrue(value.contains("; secure"));assertTrue(value.contains("; httponly"));assertTrue(value.contains("samesite=lax"));assertTrue(value.contains("path=/"));}
}
