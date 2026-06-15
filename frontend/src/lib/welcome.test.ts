import { describe, it, expect, beforeEach } from "vitest";
import { hasSeenWelcome, markWelcomeSeen } from "./welcome";

describe("welcome flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when the flag has never been set", () => {
    expect(hasSeenWelcome()).toBe(false);
  });

  it("returns true after markWelcomeSeen is called", () => {
    markWelcomeSeen();
    expect(hasSeenWelcome()).toBe(true);
  });

  it("persists the flag under the byline.hasSeenWelcome key", () => {
    markWelcomeSeen();
    expect(localStorage.getItem("byline.hasSeenWelcome")).toBe("1");
  });
});
