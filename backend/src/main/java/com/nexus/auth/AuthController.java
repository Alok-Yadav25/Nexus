package com.nexus.auth;

import com.nexus.common.Db;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController implements ApplicationRunner {
  private final Db db;
  private final PasswordEncoder encoder;
  private final String dummyHash;

  @Value("${nexus.bootstrap-email}")
  String adminEmail;

  @Value("${nexus.bootstrap-password}")
  String adminPassword;

  public AuthController(Db db, PasswordEncoder encoder) {
    this.db = db;
    this.encoder = encoder;
    this.dummyHash = encoder.encode(UUID.randomUUID().toString());
  }

  public record Credentials(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(min = 12, max = 72) String password) {}

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @GetMapping("/me")
  public Map<String, Object> me(Authentication auth) {
    if (auth == null) return Map.of("authenticated", false);
    return profile(auth.getName());
  }

  private Map<String, Object> profile(String email) {
    return db.one("SELECT id,email,role,true AS authenticated FROM users WHERE email=?", email);
  }

  @PostMapping("/register")
  public Map<String, Object> register(
      @Valid @RequestBody Credentials c, HttpServletRequest request) {
    validatePassword(c.password());
    String email = c.email().strip().toLowerCase(Locale.ROOT);
    db.update(
        "INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,'READER')",
        UUID.randomUUID(),
        email,
        encoder.encode(c.password()));
    return signIn(email, "READER", request);
  }

  @PostMapping("/login")
  public Map<String, Object> login(@Valid @RequestBody Credentials c, HttpServletRequest request) {
    validatePassword(c.password());
    var rows = db.rows("SELECT * FROM users WHERE email=?", c.email().strip().toLowerCase(Locale.ROOT));
    String hash =
        rows.isEmpty()
            ? dummyHash
            : rows.getFirst().get("password_hash").toString();
    if (!encoder.matches(c.password(), hash) || rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    return signIn(
        rows.getFirst().get("email").toString(), rows.getFirst().get("role").toString(), request);
  }

  private void validatePassword(String password) {
    if (password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must use at most 72 UTF-8 bytes");
  }

  private Map<String, Object> signIn(String email, String role, HttpServletRequest request) {
    if (request.getSession(false) != null) request.changeSessionId();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(
            email, null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    SecurityContextHolder.setContext(context);
    request
        .getSession(true)
        .setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    return profile(email);
  }

  @Override
  public void run(ApplicationArguments args) {
    if (!adminEmail.isBlank() && adminPassword.length() >= 12)
      db.update(
          "INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,'ADMIN') ON CONFLICT(email)"
              + " DO NOTHING",
          UUID.randomUUID(),
          adminEmail.toLowerCase(),
          encoder.encode(adminPassword));
  }
}
