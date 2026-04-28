import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { todayLocal, localDateFromOffset, computeDateRange } from "./dates";

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

describe("computeDateRange", () => {
  // Fixed reference date: 2026-04-24 (April = Q2, so last quarter = Q1)
  const today = new Date(2026, 3, 24, 12, 0, 0);

  it("last-month returns the previous calendar month's bounds", () => {
    expect(computeDateRange("last-month", today)).toEqual({
      start: "2026-03-01",
      end: "2026-03-31",
    });
  });

  it("last-quarter returns the previous calendar quarter's bounds", () => {
    expect(computeDateRange("last-quarter", today)).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
    });
  });

  it("ytd returns Jan 1 of the current year to today", () => {
    expect(computeDateRange("ytd", today)).toEqual({
      start: "2026-01-01",
      end: "2026-04-24",
    });
  });

  it("last-year returns Jan 1 to Dec 31 of the previous year", () => {
    expect(computeDateRange("last-year", today)).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
    });
  });

  it("all returns an unbounded lower bound up to today", () => {
    expect(computeDateRange("all", today)).toEqual({
      start: "0000-01-01",
      end: "2026-04-24",
    });
  });

  it("last-month rolls year over when today is in January", () => {
    const jan = new Date(2026, 0, 15, 12, 0, 0);
    expect(computeDateRange("last-month", jan)).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  it("last-quarter rolls year over when today is in Q1", () => {
    const q1 = new Date(2026, 1, 15, 12, 0, 0);
    expect(computeDateRange("last-quarter", q1)).toEqual({
      start: "2025-10-01",
      end: "2025-12-31",
    });
  });
});
