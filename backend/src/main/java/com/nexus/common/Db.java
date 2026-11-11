package com.nexus.common;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class Db {
  public final JdbcTemplate jdbc;

  public Db(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<Map<String, Object>> rows(String sql, Object... args) {
    return jdbc.query(
        sql,
        (rs, n) -> {
          var row = new LinkedHashMap<String, Object>();
          var meta = rs.getMetaData();
          for (int i = 1; i <= meta.getColumnCount(); i++) {
            Object v = rs.getObject(i);
            if (v != null && meta.getColumnTypeName(i).equals("jsonb")) v = Json.value(v.toString());
            row.put(meta.getColumnLabel(i), v);
          }
          return row;
        },
        args);
  }

  public Map<String, Object> one(String sql, Object... args) {
    var rows = rows(sql, args);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found");
    return rows.getFirst();
  }

  public int update(String sql, Object... args) {
    return jdbc.update(sql, args);
  }

  public long count(String table) {
    if (!Set.of("articles", "entities", "relationships", "sources", "research_jobs", "claims")
        .contains(table)) throw new IllegalArgumentException();
    return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
  }
}
