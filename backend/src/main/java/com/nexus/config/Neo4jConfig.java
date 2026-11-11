package com.nexus.config;

import java.util.concurrent.TimeUnit;
import org.neo4j.driver.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

@Configuration
public class Neo4jConfig {
  @Bean(destroyMethod = "close")
  Driver graphDriver(
      @Value("${nexus.neo4j-uri}") String uri, @Value("${nexus.neo4j-password}") String password) {
    return GraphDatabase.driver(
        uri,
        AuthTokens.basic("neo4j", password),
        Config.builder()
            .withConnectionTimeout(2, TimeUnit.SECONDS)
            .withMaxConnectionPoolSize(8)
            .build());
  }
}
