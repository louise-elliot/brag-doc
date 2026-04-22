import { describe, it, expect } from "vitest";
import { getPromptForDate, getRandomPromptExcluding, PROMPTS } from "./prompts";

describe("prompts", () => {
  it("returns a prompt string", () => {
    const prompt = getPromptForDate("2026-04-01");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns the same prompt for the same date", () => {
    const a = getPromptForDate("2026-04-01");
    const b = getPromptForDate("2026-04-01");
    expect(a).toBe(b);
  });

  it("returns different prompts for different dates", () => {
    const prompts = new Set(
      Array.from({ length: 30 }, (_, i) =>
        getPromptForDate(`2026-04-${String(i + 1).padStart(2, "0")}`)
      )
    );
    expect(prompts.size).toBeGreaterThan(1);
  });

  it("has 9 prompts in the pool", () => {
    expect(PROMPTS).toHaveLength(9);
  });

  describe("getRandomPromptExcluding", () => {
    it("returns a prompt from the pool", () => {
      const prompt = getRandomPromptExcluding(PROMPTS[0]);
      expect(PROMPTS).toContain(prompt);
    });

    it("never returns the excluded prompt when others are available", () => {
      const excluded = PROMPTS[0];
      for (let i = 0; i < 50; i++) {
        expect(getRandomPromptExcluding(excluded)).not.toBe(excluded);
      }
    });
  });
});
