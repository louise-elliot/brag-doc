import { describe, it, expect, beforeEach } from "vitest";
import {
  getEntries,
  addEntry,
  updateEntry,
  deleteAllEntries,
  deleteEntry,
  editEntry,
  getEntriesByDateRange,
  renameTagOnEntries,
} from "./entries";
import type { Entry } from "./types";

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

describe("getEntries with corrupt storage", () => {
  it("returns empty array when localStorage value is not valid JSON", () => {
    localStorage.setItem("confidence-journal-entries", "{not json");
    expect(getEntries()).toEqual([]);
  });

  it("returns empty array when localStorage value is JSON but not an array", () => {
    localStorage.setItem("confidence-journal-entries", JSON.stringify({ foo: "bar" }));
    expect(getEntries()).toEqual([]);
  });
});

describe("getEntries same-day ordering", () => {
  it("sorts same-day entries newest-first by createdAt", () => {
    const earlier = {
      id: "a",
      date: "2026-04-22",
      prompt: "",
      original: "earlier",
      reframed: null,
      tags: [],
      createdAt: "2026-04-22T09:00:00.000Z",
    };
    const later = {
      id: "b",
      date: "2026-04-22",
      prompt: "",
      original: "later",
      reframed: null,
      tags: [],
      createdAt: "2026-04-22T17:00:00.000Z",
    };
    // Insert earlier first so default insertion order would yield [earlier, later]
    localStorage.setItem(
      "confidence-journal-entries",
      JSON.stringify([earlier, later])
    );
    const result = getEntries();
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("a");
  });
});

describe("renameTagOnEntries", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("rewrites the old tag name to the new one on every matching entry", () => {
    addEntry(makeEntry({ tags: ["leadership", "technical"] }));
    addEntry(makeEntry({ tags: ["leadership"] }));
    addEntry(makeEntry({ tags: ["mentoring"] }));

    renameTagOnEntries("leadership", "leading");

    const all = getEntries();
    expect(all.filter((e) => e.tags.includes("leading"))).toHaveLength(2);
    expect(all.filter((e) => e.tags.includes("leadership"))).toHaveLength(0);
  });

  it("is a no-op when no entries have the tag", () => {
    addEntry(makeEntry({ tags: ["technical"] }));
    renameTagOnEntries("leadership", "leading");
    expect(getEntries()[0].tags).toEqual(["technical"]);
  });
});

describe("deleteEntry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes the matching entry", () => {
    const a = addEntry(makeEntry({ original: "a" }));
    addEntry(makeEntry({ original: "b" }));
    deleteEntry(a.id);
    const all = getEntries();
    expect(all).toHaveLength(1);
    expect(all[0].original).toBe("b");
  });

  it("is a no-op when the id is not found", () => {
    addEntry(makeEntry({ original: "a" }));
    deleteEntry("not-a-real-id");
    expect(getEntries()).toHaveLength(1);
  });
});

describe("editEntry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("nullifies reframed when the original text changes", () => {
    const entry = addEntry(
      makeEntry({ original: "first pass", reframed: "reframed version" })
    );
    editEntry(entry.id, { original: "second pass" });
    const updated = getEntries().find((e) => e.id === entry.id)!;
    expect(updated.original).toBe("second pass");
    expect(updated.reframed).toBeNull();
  });

  it("preserves reframed when only tags change", () => {
    const entry = addEntry(
      makeEntry({ tags: ["technical"], reframed: "reframed version" })
    );
    editEntry(entry.id, { tags: ["leadership"] });
    const updated = getEntries().find((e) => e.id === entry.id)!;
    expect(updated.tags).toEqual(["leadership"]);
    expect(updated.reframed).toBe("reframed version");
  });

  it("does not nullify reframed when original is unchanged", () => {
    const entry = addEntry(
      makeEntry({ original: "same text", reframed: "reframed version" })
    );
    editEntry(entry.id, { original: "same text", tags: ["leadership"] });
    const updated = getEntries().find((e) => e.id === entry.id)!;
    expect(updated.reframed).toBe("reframed version");
    expect(updated.tags).toEqual(["leadership"]);
  });

  it("is a no-op when the id is not found", () => {
    addEntry(makeEntry({ original: "original text" }));
    editEntry("not-a-real-id", { original: "new text" });
    expect(getEntries()[0].original).toBe("original text");
  });
});
