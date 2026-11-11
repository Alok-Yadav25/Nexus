package com.nexus.research;

import java.util.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisTaskCoordinator implements TaskCoordinator {
  private final StringRedisTemplate redis;

  public RedisTaskCoordinator(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public Optional<UUID> next() {
    try {
      String id = redis.opsForList().rightPop("nexus:research:ready");
      return id == null ? Optional.empty() : Optional.of(UUID.fromString(id));
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  public void signal(UUID job) {
    try {
      redis.opsForList().leftPush("nexus:research:ready", job.toString());
      redis.opsForList().trim("nexus:research:ready", 0, 9999);
    } catch (Exception ignored) {
    }
  }

  public void event(UUID job, String stage, String message) {
    try {
      redis
          .opsForStream()
          .add(
              "nexus:research:events",
              Map.of("jobId", job.toString(), "stage", stage, "message", message));
      redis.opsForStream().trim("nexus:research:events", 10000, true);
    } catch (Exception ignored) {
    }
  }
}
