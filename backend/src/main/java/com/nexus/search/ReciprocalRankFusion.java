package com.nexus.search;

import java.util.*;

public final class ReciprocalRankFusion {
  public record Result(String id, double score, List<String> reasons) {}

  public static List<Result> rank(Map<String, List<String>> rankings, int k) {
    if (k < 1) throw new IllegalArgumentException();
    Map<String, Double> scores = new HashMap<>();
    Map<String, List<String>> reasons = new HashMap<>();
    rankings.forEach(
        (source, ids) -> {
          Set<String> seen = new HashSet<>();
          for (int i = 0; i < ids.size(); i++) {
            String id = ids.get(i);
            if (seen.add(id)) {
              scores.merge(id, 1.0 / (k + i + 1), Double::sum);
              reasons.computeIfAbsent(id, x -> new ArrayList<>()).add(source);
            }
          }
        });
    return scores.entrySet().stream()
        .map(e -> new Result(e.getKey(), e.getValue(), List.copyOf(reasons.get(e.getKey()))))
        .sorted(Comparator.comparingDouble(Result::score).reversed().thenComparing(Result::id))
        .toList();
  }

  private ReciprocalRankFusion() {}
}
