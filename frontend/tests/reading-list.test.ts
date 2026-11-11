import { afterEach, describe, expect, it } from "vitest";
import {
  parseReadingList,
  readReadingList,
  removeReading,
  saveReading,
  updateReadingProgress,
} from "../lib/reading-list";
afterEach(() => localStorage.clear());
describe("local reading list", () => {
  it("persists a real identity, avoids duplicates and keeps progress", () => {
    saveReading({ id: 42, title: "Granite", revisionId: 123 });
    saveReading({ id: 42, title: "Granite", revisionId: 123 });
    updateReadingProgress(42, 38, "wiki-Description");
    expect(readReadingList()).toHaveLength(1);
    expect(readReadingList()[0]).toMatchObject({
      id: 42,
      progress: 38,
      anchor: "wiki-Description",
    });
    removeReading(42);
    expect(readReadingList()).toEqual([]);
  });
  it("ignores corrupted or unsafe stored data", () => {
    expect(parseReadingList("invalid JSON")).toEqual([]);
    expect(
      parseReadingList(
        JSON.stringify([
          {
            id: 1,
            title: "Bad",
            revisionId: 2,
            savedAt: "2026-11-11",
            progress: 10,
            anchor: "javascript:bad",
          },
        ]),
      ),
    ).toEqual([]);
  });
});
