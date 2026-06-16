import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AdminCostPage from "./page";

const ORIGINAL_FETCH = global.fetch;
afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.clearAllMocks();
});

const SUMMARY = {
  budget_usd: 5,
  today_spend_usd: 1.25,
  daily: [{ day: "2026-06-16", cost_usd: 1.25, request_count: 4 }],
  breakdown: [
    { endpoint: "coach_turn", model: "claude-haiku-4-5-20251001",
      cost_usd: 1.25, request_count: 4, input_tokens: 4800, output_tokens: 600 },
  ],
};

describe("AdminCostPage", () => {
  it("renders today's spend, budget, and the breakdown", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SUMMARY), { status: 200 })
    );
    render(<AdminCostPage />);
    // $1.25 and $5.00 each appear in several nested rows, so assert with
    // getAllByText; use unambiguous strings for the breakdown + daily rows.
    await waitFor(() => expect(screen.getByText("coach_turn")).toBeInTheDocument());
    expect(screen.getByText("claude-haiku-4-5-20251001")).toBeInTheDocument();
    expect(screen.getByText("2026-06-16")).toBeInTheDocument();
    expect(screen.getAllByText(/\$1\.25/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$5\.00/).length).toBeGreaterThan(0);
  });

  it("shows Not authorized on 403", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    render(<AdminCostPage />);
    await waitFor(() =>
      expect(screen.getByText(/not authorized/i)).toBeInTheDocument()
    );
  });

  it("shows an error message when the request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    render(<AdminCostPage />);
    await waitFor(() =>
      expect(screen.getByText(/could not load/i)).toBeInTheDocument()
    );
  });
});
