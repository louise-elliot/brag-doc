import { describe, it, expect, beforeEach } from "vitest";
import {
  PALETTE,
  getTags,
  saveTags,
  nextUnusedColor,
  tagColorFor,
  tagColorFromHex,
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
      saveTags([{ name: "focus", color: "#D4863C" }]);
      expect(getTags()).toEqual([{ name: "focus", color: "#D4863C" }]);
    });

    it("returns empty list when user has deleted all tags", () => {
      saveTags([]);
      expect(getTags()).toEqual([]);
    });
  });

  describe("nextUnusedColor", () => {
    it("returns the first palette color that is not in use", () => {
      const tags = [
        { name: "a", color: PALETTE[0] },
        { name: "b", color: PALETTE[1] },
      ];
      expect(nextUnusedColor(tags)).toBe(PALETTE[2]);
    });

    it("cycles the palette when every color is already used", () => {
      const tags = PALETTE.map((color, i) => ({ name: `t${i}`, color }));
      expect(PALETTE).toContain(nextUnusedColor(tags));
    });
  });

  describe("tagColorFor", () => {
    it("returns a TagColor from the matching tag's hex", () => {
      const tags = [{ name: "focus", color: "#D4863C" }];
      const c = tagColorFor(tags, "focus");
      expect(c).toEqual({
        color: "#D4863C",
        bg: "rgba(212,134,60,0.12)",
        border: "rgba(212,134,60,0.3)",
      });
    });

    it("returns null for tag names that are not in the list", () => {
      expect(tagColorFor([], "missing")).toBeNull();
    });
  });

  describe("tagColorFromHex", () => {
    it("derives bg and border in the same alpha pattern as the old palette", () => {
      expect(tagColorFromHex("#6B8AE0")).toEqual({
        color: "#6B8AE0",
        bg: "rgba(107,138,224,0.12)",
        border: "rgba(107,138,224,0.3)",
      });
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
