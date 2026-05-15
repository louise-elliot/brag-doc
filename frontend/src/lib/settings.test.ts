import { describe, it, expect, beforeEach } from "vitest";
import { readSettings, writeSettings, serializeContext } from "./settings";
import { DEFAULT_USER_SETTINGS } from "./types";

const KEY = "confidence-journal-settings";

describe("settings data layer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when localStorage key is missing", () => {
    expect(readSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("returns defaults when localStorage value is not valid JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("returns defaults when localStorage value is JSON but not an object", () => {
    localStorage.setItem(KEY, JSON.stringify(["nope"]));
    expect(readSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("tolerates partial blobs by filling in missing fields with defaults", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ coachingStyle: "hype-woman" })
    );
    expect(readSettings()).toEqual({
      ...DEFAULT_USER_SETTINGS,
      coachingStyle: "hype-woman",
    });
  });

  it("falls back to default when stored coachingStyle is not a known value", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ coachingStyle: "made-up-style" })
    );
    expect(readSettings().coachingStyle).toBe(
      DEFAULT_USER_SETTINGS.coachingStyle
    );
  });

  it("does not write to storage on read", () => {
    readSettings();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("writeSettings merges rather than clobbering", () => {
    writeSettings({ contextHeadline: "Senior backend engineer" });
    writeSettings({ contextNotes: "Working towards staff" });
    expect(readSettings()).toEqual({
      ...DEFAULT_USER_SETTINGS,
      contextHeadline: "Senior backend engineer",
      contextNotes: "Working towards staff",
    });
  });
});

describe("serializeContext", () => {
  it("returns null when both context fields are empty strings", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "",
        contextNotes: "",
      })
    ).toBeNull();
  });

  it("returns null when both context fields are whitespace only", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "   ",
        contextNotes: "\n\n",
      })
    ).toBeNull();
  });

  it("returns headline and notes when at least one field has content", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "Senior PM",
        contextNotes: "",
      })
    ).toEqual({ headline: "Senior PM", notes: "" });
  });

  it("preserves the raw values without trimming so the user's formatting survives", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "  Senior PM  ",
        contextNotes: "Line 1\nLine 2",
      })
    ).toEqual({ headline: "  Senior PM  ", notes: "Line 1\nLine 2" });
  });
});
