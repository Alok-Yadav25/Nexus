package com.nexus;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/** Local PostgreSQL launcher. NEXUS_DEV_DATA_DIR enables retained development storage. */
public class LocalApplication {
  public static void main(String[] args) throws Exception {
    var builder = EmbeddedPostgres.builder().setPort(55432);
    String directory = System.getenv("NEXUS_DEV_DATA_DIR");
    if (directory != null && !directory.isBlank())
      builder.setDataDirectory(java.nio.file.Path.of(directory)).setCleanDataDirectory(false);
    var pg = builder.start();
    Runtime.getRuntime()
        .addShutdownHook(
            new Thread(
                () -> {
                  try {
                    pg.close();
                  } catch (Exception ignored) {
                  }
                }));
    System.setProperty("spring.datasource.url", pg.getJdbcUrl("postgres", "postgres"));
    System.setProperty("spring.datasource.username", "postgres");
    System.setProperty("spring.datasource.password", "");
    NexusApplication.main(args);
  }
}
