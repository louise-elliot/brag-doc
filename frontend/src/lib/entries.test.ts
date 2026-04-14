import { describe, it, expect, beforeEach } from "vitest";
import {
  getEntries,
  addEntry,
  updateEntry,
  deleteAllEntries,
  getEntriesByDateRange,
} from "./entries";
import type { Entry } from "./types";

const STORAGE_KEY = "confidence-journal-entries";

function makeEntry(overrides: Partial<Entry> = {}): Omit<Entry, "id" | "createdAt"> {
  return {
    date: "2026-04-01",
    prompt: "What impact did you make today?",
    original: "I helped the team fix a bug",
    reframed: null,
    tags: ["technical"],
    ...overrides,
  };
}

describe("entries data layer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no entries exist", () => {
    expect(getEntries()).toEqual([]);
  });

  it("adds an entry and retrieves it", () => {
    const entry = addEntry(makeEntry());
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeDefined();
    const all = getEntries();
    expect(all).toHaveLength(1);
    expect(all[0].original).toBe("I helped the team fix a bug");
  });

  it("returns entries newest first", () => {
    addEntry(makeEntry({ date: "2026-03-01", original: "first" }));
    addEntry(makeEntry({ date: "2026-04-01", original: "second" }));
    const all = getEntries();
    expect(all[0].original).toBe("second");
    expect(all[1].original).toBe("first");
  });

  it("updates an entry", () => {
    const entry = addEntry(makeEntry());
    updateEntry(entry.id, { reframed: "I resolved a critical bug" });
    const updated = getEntries()[0];
    expect(updated.reframed).toBe("I resolved a critical bug");
    expect(updated.original).toBe("I helped the team fix a bug");
  });

  it("deletes all entries", () => {
    addEntry(makeEntry());
    addEntry(makeEntry());
    deleteAllEntries();
    expect(getEntries()).toEqual([]);
  });

  it("filters entries by date range", () => {
    addEntry(makeEntry({ date: "2026-01-15" }));
    addEntry(makeEntry({ date: "2026-03-15" }));
    addEntry(makeEntry({ date: "2026-04-01" }));
    const filtered = getEntriesByDateRange("2026-03-01", "2026-04-02");
    expect(filtered).toHaveLength(2);
  });
});
