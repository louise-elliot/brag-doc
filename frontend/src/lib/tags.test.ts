import { describe, it, expect, beforeEach } from "vitest";
import {
  getTags,
  saveTags,
  isDuplicateName,
} from "./tags";

describe("tags", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getTags", () => {
    it("seeds the default 6 tags on first read", () => {
      const tags = getTags();
      expect(tags).toHaveLength(6);
      expect(tags.map((t) => t.name)).toEqual([
        "leadership",
        "technical",
        "collaboration",
        "problem-solving",
        "communication",
        "mentoring",
      ]);
    });

    it("returns the stored list on subsequent reads", () => {
      saveTags([{ name: "focus" }]);
      expect(getTags()).toEqual([{ name: "focus" }]);
    });

    it("returns empty list when user has deleted all tags", () => {
      saveTags([]);
      expect(getTags()).toEqual([]);
    });
  });

  describe("isDuplicateName", () => {
    const tags = [{ name: "leadership", color: "#D4863C" }];

    it("is case-insensitive", () => {
      expect(isDuplicateName(tags, "Leadership")).toBe(true);
      expect(isDuplicateName(tags, "LEADERSHIP")).toBe(true);
    });

    it("trims whitespace before comparing", () => {
      expect(isDuplicateName(tags, "  leadership  ")).toBe(true);
    });

    it("returns false when the name is not a duplicate", () => {
      expect(isDuplicateName(tags, "technical")).toBe(false);
    });

    it("returns false for empty or whitespace-only names", () => {
      expect(isDuplicateName(tags, "")).toBe(false);
      expect(isDuplicateName(tags, "   ")).toBe(false);
    });

    it("excludes the tag being renamed from the duplicate check", () => {
      expect(isDuplicateName(tags, "Leadership", "leadership")).toBe(false);
    });
  });
});
