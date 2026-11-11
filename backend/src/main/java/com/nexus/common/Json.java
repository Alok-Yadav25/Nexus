package com.nexus.common;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public final class Json {
  private static final ObjectMapper MAPPER =
      new ObjectMapper()
          .findAndRegisterModules()
          .enable(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);

  public static String write(Object value) {
    try {
      return MAPPER.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON", e);
    }
  }

  public static String pretty(Object value) {
    try {
      return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON", e);
    }
  }

  public static Object value(String value) {
    try { return MAPPER.readValue(value,Object.class); }
    catch(Exception e) { throw new IllegalArgumentException("Invalid JSON",e); }
  }

  public static Map<String, Object> map(String value) {
    try {
      return MAPPER.readValue(value, new TypeReference<>() {});
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON object", e);
    }
  }

  public static List<Map<String, Object>> rows(String value) {
    try {
      return MAPPER.readValue(value, new TypeReference<>() {});
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON array", e);
    }
  }

  private Json() {}
}
