package com.nexus.search;

import java.text.Normalizer;
import java.util.*;

/** Compressed Unicode radix tree. Mutations and reads share a monitor for consistent rankings. */
public final class RadixTrie {
  public record Entry(String id, String name, String slug, long popularity) {}

  private static final class Node {
    String label;
    Map<Integer, Node> children = new HashMap<>();
    Map<String, Entry> entries = new HashMap<>();

    Node(String label) {
      this.label = label;
    }
  }

  private final Node root = new Node("");

  public static String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFKC)
        .strip()
        .toLowerCase(Locale.ROOT)
        .replaceAll("\\s+", " ");
  }

  public synchronized void insert(String key, Entry entry) {
    String text = normalize(key);
    if (!text.isEmpty()) insert(root, text, entry);
  }

  private void insert(Node parent, String text, Entry entry) {
    int first = text.codePointAt(0);
    Node child = parent.children.get(first);
    if (child == null) {
      child = new Node(text);
      child.entries.put(entry.id(), entry);
      parent.children.put(first, child);
      return;
    }
    int common = common(text, child.label);
    if (common < child.label.length()) {
      Node suffix = new Node(child.label.substring(common));
      suffix.children = child.children;
      suffix.entries = child.entries;
      child.label = child.label.substring(0, common);
      child.children = new HashMap<>();
      child.children.put(suffix.label.codePointAt(0), suffix);
      child.entries = new HashMap<>();
    }
    if (common == text.length()) child.entries.put(entry.id(), entry);
    else insert(child, text.substring(common), entry);
  }

  private int common(String a, String b) {
    int i = 0;
    while (i < a.length() && i < b.length()) {
      int cp = a.codePointAt(i);
      if (cp != b.codePointAt(i)) break;
      i += Character.charCount(cp);
    }
    return i;
  }

  public synchronized List<Entry> prefix(String prefix, int limit) {
    String text = normalize(prefix);
    if (text.isEmpty()) return List.of();
    Node node = root;
    while (!text.isEmpty()) {
      Node next = node.children.get(text.codePointAt(0));
      if (next == null) return List.of();
      int common = common(text, next.label);
      if (common == text.length()) {
        node = next;
        break;
      }
      if (common != next.label.length()) return List.of();
      text = text.substring(common);
      node = next;
    }
    Map<String, Entry> found = new HashMap<>();
    collect(node, found);
    return found.values().stream()
        .sorted(Comparator.comparingLong(Entry::popularity).reversed().thenComparing(Entry::name))
        .limit(Math.clamp(limit, 1, 20))
        .toList();
  }

  private void collect(Node n, Map<String, Entry> found) {
    n.entries.forEach(
        (k, v) -> found.merge(k, v, (a, b) -> a.popularity() > b.popularity() ? a : b));
    for (Node c : n.children.values()) collect(c, found);
  }

  public synchronized void remove(String key, String id) {
    remove(root, normalize(key), id);
  }

  private boolean remove(Node parent, String text, String id) {
    if (text.isEmpty()) return parent.entries.remove(id) != null;
    Node child = parent.children.get(text.codePointAt(0));
    if (child == null || !text.startsWith(child.label)) return false;
    boolean removed = remove(child, text.substring(child.label.length()), id);
    if (child.entries.isEmpty()) {
      if (child.children.isEmpty()) parent.children.remove(child.label.codePointAt(0));
      else if (child.children.size() == 1) {
        Node c = child.children.values().iterator().next();
        child.label += c.label;
        child.entries = c.entries;
        child.children = c.children;
      }
    }
    return removed;
  }

  public synchronized void clear() {
    root.children.clear();
    root.entries.clear();
  }
}
