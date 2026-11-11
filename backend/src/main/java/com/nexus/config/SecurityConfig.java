package com.nexus.config;

import com.nexus.common.Db;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.*;
import org.springframework.web.cors.*;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  UserDetailsService userDetails(Db db) {
    return email -> {
      var rows = db.rows("SELECT * FROM users WHERE email=?", email.toLowerCase());
      if (rows.isEmpty()) throw new UsernameNotFoundException("Invalid credentials");
      var u = rows.getFirst();
      return User.withUsername(u.get("email").toString())
          .password(u.get("password_hash").toString())
          .roles(u.get("role").toString())
          .build();
    };
  }

  @Bean
  SecurityFilterChain security(HttpSecurity http, @Value("${nexus.frontend-origin}") String origin)
      throws Exception {
    var csrf = new HttpSessionCsrfTokenRepository();
    http.cors(
            c ->
                c.configurationSource(
                    request -> {
                      var cors = new CorsConfiguration();
                      cors.setAllowedOrigins(
                          java.util.Arrays.stream(origin.split(",")).map(String::strip).toList());
                      cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                      cors.setAllowedHeaders(List.of("Content-Type", "X-CSRF-TOKEN"));
                      cors.setAllowCredentials(true);
                      return cors;
                    }))
        .csrf(
            c ->
                c.csrfTokenRepository(csrf)
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/actuator/health",
                        "/api/v1/auth/**",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/compare")
                    .permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (req, res, ex) -> {
                          res.setStatus(401);
                          res.setContentType("application/json");
                          res.getWriter().write("{\"error\":\"Sign in to continue\"}");
                        })
                    .accessDeniedHandler(
                        (req, res, ex) -> {
                          res.setStatus(403);
                          res.setContentType("application/json");
                          res.getWriter()
                              .write(
                                  "{\"error\":\"This action requires permission and a valid CSRF"
                                      + " token\"}");
                        }))
        .logout(
            l ->
                l.logoutUrl("/api/v1/auth/logout")
                    .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
        .headers(
            h ->
                h.contentSecurityPolicy(
                    c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'")));
    return http.build();
  }
}
