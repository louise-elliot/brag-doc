import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { todayLocal, localDateFromOffset } from "./dates";

describe("todayLocal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD in local time, not UTC", () => {
    // 2026-04-22 at 23:30 local — toISOString() would roll over to 2026-04-23 in UTC-heavy zones
    vi.setSystemTime(new Date(2026, 3, 22, 23, 30, 0));
    expect(todayLocal()).toBe("2026-04-22");
  });

  it("pads month and day", () => {
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
    expect(todayLocal()).toBe("2026-01-05");
  });
});

describe("localDateFromOffset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 22, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("subtracts days in local time", () => {
    expect(localDateFromOffset(30)).toBe("2026-03-23");
  });

  it("returns today for offset 0", () => {
    expect(localDateFromOffset(0)).toBe("2026-04-22");
  });
});
