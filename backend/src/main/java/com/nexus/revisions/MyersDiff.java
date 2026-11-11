package com.nexus.revisions;

import java.util.*;

/** Shortest insert/delete edit script, Myers O((N+M)D) with trace backtracking. */
public final class MyersDiff {
  public record Edit(String type, String text) {}

  public static List<Edit> diff(String before, String after) {
    String[] a = before.split("\\n", -1), b = after.split("\\n", -1);
    int max = a.length + b.length, offset = max + 1;
    int[] v = new int[2 * max + 3];
    List<int[]> trace = new ArrayList<>();
    for (int d = 0; d <= max; d++) {
      trace.add(v.clone());
      for (int k = -d; k <= d; k += 2) {
        int x;
        if (k == -d || (k != d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
        else x = v[offset + k - 1] + 1;
        int y = x - k;
        while (x < a.length && y < b.length && a[x].equals(b[y])) {
          x++;
          y++;
        }
        v[offset + k] = x;
        if (x >= a.length && y >= b.length) return backtrack(trace, a, b, offset);
      }
    }
    throw new IllegalStateException();
  }

  private static List<Edit> backtrack(List<int[]> trace, String[] a, String[] b, int off) {
    List<Edit> edits = new ArrayList<>();
    int x = a.length, y = b.length;
    for (int d = trace.size() - 1; d >= 0; d--) {
      int[] v = trace.get(d);
      int k = x - y,
          prevK = (k == -d || (k != d && v[off + k - 1] < v[off + k + 1])) ? k + 1 : k - 1;
      int prevX = v[off + prevK], prevY = prevX - prevK;
      while (x > prevX && y > prevY) {
        edits.add(new Edit("EQUAL", a[--x]));
        y--;
      }
      if (d > 0) {
        if (x == prevX) edits.add(new Edit("ADD", b[--y]));
        else edits.add(new Edit("REMOVE", a[--x]));
      }
    }
    Collections.reverse(edits);
    return edits;
  }

  private MyersDiff() {}
}
