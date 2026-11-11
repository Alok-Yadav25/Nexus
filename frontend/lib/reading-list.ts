import type { WikiArticle } from "./encyclopedia";

export type SavedReading = {
  id: number;
  title: string;
  revisionId: number;
  savedAt: string;
  progress: number;
  anchor: string;
};
export const READING_LIST_KEY = "nexus-reading-list:v1";
export const READING_LIST_EVENT = "nexus-reading-list-changed";

export function parseReadingList(raw: string | null): SavedReading[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set<number>();
    return value
      .slice(0, 100)
      .filter((item): item is SavedReading => {
        if (!item || typeof item !== "object") return false;
        const row = item as SavedReading;
        if (
          !Number.isSafeInteger(row.id) ||
          row.id <= 0 ||
          seen.has(row.id) ||
          typeof row.title !== "string" ||
          !row.title.trim() ||
          row.title.length > 240 ||
          !Number.isSafeInteger(row.revisionId) ||
          typeof row.savedAt !== "string" ||
          !Number.isFinite(Date.parse(row.savedAt)) ||
          !Number.isFinite(row.progress) ||
          row.progress < 0 ||
          row.progress > 100 ||
          typeof row.anchor !== "string" ||
          row.anchor.length > 305 ||
          (row.anchor !== "" && !row.anchor.startsWith("wiki-"))
        )
          return false;
        seen.add(row.id);
        return true;
      })
      .map((row) => ({
        id: row.id,
        title: row.title,
        revisionId: row.revisionId,
        savedAt: row.savedAt,
        progress: row.progress,
        anchor: row.anchor,
      }));
  } catch {
    return [];
  }
}

export function readReadingList() {
  return parseReadingList(window.localStorage.getItem(READING_LIST_KEY));
}
function change(update: (items: SavedReading[]) => SavedReading[]) {
  const items = update(readReadingList());
  window.localStorage.setItem(READING_LIST_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(READING_LIST_EVENT));
}
export function saveReading(
  article: Pick<WikiArticle, "id" | "title" | "revisionId">,
) {
  change((items) => {
    if (items.some((item) => item.id === article.id)) return items;
    if (items.length >= 100)
      throw new Error(
        "Your reading list has 100 articles. Remove one before saving another.",
      );
    return [
      {
        id: article.id,
        title: article.title,
        revisionId: article.revisionId,
        savedAt: new Date().toISOString(),
        progress: 0,
        anchor: "",
      },
      ...items,
    ];
  });
}
export function removeReading(id: number) {
  change((items) => items.filter((item) => item.id !== id));
}
export function updateReadingProgress(
  id: number,
  progress: number,
  anchor: string,
) {
  change((items) =>
    items.map((item) =>
      item.id === id
        ? { ...item, progress: Math.max(0, Math.min(100, progress)), anchor }
        : item,
    ),
  );
}
