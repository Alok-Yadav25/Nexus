package com.nexus.research;

import java.util.Optional;
import java.util.UUID;

/** Advisory coordination only. Canonical jobs and event history remain in PostgreSQL. */
public interface TaskCoordinator {
  Optional<UUID> next();

  void signal(UUID job);

  void event(UUID job, String stage, String message);
}
