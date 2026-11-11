package com.nexus;

import static org.junit.jupiter.api.Assertions.*;

import com.nexus.revisions.MyersDiff;
import com.nexus.search.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;

class AlgorithmsTest {
  @Test
  void radixSplitsMergesAliasesUnicodeAndRanking() {
    var trie = new RadixTrie();
    var lithium = new RadixTrie.Entry("1", "Lithium", "lithium", 2);
    var battery = new RadixTrie.Entry("2", "Lithium-ion batteries", "lithium-ion-batteries", 10);
    trie.insert("Lithium", lithium);
    trie.insert("Li", lithium);
    trie.insert("lithium-ion batteries", battery);
    trie.insert("LITHIUM", lithium);
    assertEquals(List.of(battery, lithium), trie.prefix("ＬＩ", 8));
    assertEquals(List.of(battery), trie.prefix("li", 1));
  }

  @Test
  void radixDeletionMergesWithoutLosingSibling() {
    var t = new RadixTrie();
    var a = new RadixTrie.Entry("a", "alpha", "a", 1);
    var b = new RadixTrie.Entry("b", "alphabet", "b", 2);
    t.insert("alpha", a);
    t.insert("alphabet", b);
    t.remove("alpha", "a");
    assertEquals(List.of(b), t.prefix("alph", 5));
    t.remove("alphabet", "b");
    assertTrue(t.prefix("a", 5).isEmpty());
    t.insert("αβ", a);
    assertEquals(List.of(a), t.prefix("Α", 5));
  }

  @Test
  void radixConcurrentWritesAndReads() throws Exception {
    var t = new RadixTrie();
    try (var executor = Executors.newFixedThreadPool(8)) {
      var tasks = new ArrayList<Callable<Void>>();
      for (int i = 0; i < 100; i++) {
        int n = i;
        tasks.add(
            () -> {
              t.insert("topic " + n, new RadixTrie.Entry("" + n, "topic " + n, "t" + n, n));
              t.prefix("top", 10);
              return null;
            });
      }
      for (var future : executor.invokeAll(tasks)) future.get();
    }
    assertEquals(20, t.prefix("topic", 20).size());
    assertEquals("99", t.prefix("topic", 1).getFirst().id());
  }

  @Test
  void rrfFusesAndDeduplicates() {
    var r =
        ReciprocalRankFusion.rank(
            Map.of("exact", List.of("a", "a", "b"), "vector", List.of("b", "a")), 60);
    assertEquals(2, r.size());
    assertEquals("a", r.getFirst().id());
    assertEquals(1.0 / 61 + 1.0 / 62, r.getFirst().score(), 1e-10);
    assertEquals(2, r.getFirst().reasons().size());
  }

  @Test
  void myersMinimalScriptsReconstructRandomInputs() {
    Random random = new Random(42);
    for (int sample = 0; sample < 200; sample++) {
      String a = randomText(random), b = randomText(random);
      var edits = MyersDiff.diff(a, b);
      assertEquals(
          a,
          String.join(
              "\n",
              edits.stream()
                  .filter(e -> !e.type().equals("ADD"))
                  .map(MyersDiff.Edit::text)
                  .toList()));
      assertEquals(
          b,
          String.join(
              "\n",
              edits.stream()
                  .filter(e -> !e.type().equals("REMOVE"))
                  .map(MyersDiff.Edit::text)
                  .toList()));
      String[] x = a.split("\n", -1), y = b.split("\n", -1);
      int[][] dp = new int[x.length + 1][y.length + 1];
      for (int i = 0; i <= x.length; i++) dp[i][0] = i;
      for (int j = 0; j <= y.length; j++) dp[0][j] = j;
      for (int i = 1; i <= x.length; i++)
        for (int j = 1; j <= y.length; j++)
          dp[i][j] =
              x[i - 1].equals(y[j - 1])
                  ? dp[i - 1][j - 1]
                  : 1 + Math.min(dp[i - 1][j], dp[i][j - 1]);
      assertEquals(
          dp[x.length][y.length], edits.stream().filter(e -> !e.type().equals("EQUAL")).count());
    }
  }

  private String randomText(Random r) {
    List<String> out = new ArrayList<>();
    for (int i = 0, n = r.nextInt(10) + 1; i < n; i++) out.add("line" + r.nextInt(5));
    return String.join("\n", out);
  }
}
