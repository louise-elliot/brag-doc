import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

vi.mock("@/lib/entries", () => ({
  getEntries: vi.fn().mockReturnValue([]),
  addEntry: vi.fn().mockReturnValue({
    id: "1",
    date: "2026-04-01",
    prompt: "What impact?",
    original: "Test entry",
    reframed: null,
    tags: [],
    createdAt: "2026-04-01T18:00:00Z",
  }),
  updateEntry: vi.fn(),
  deleteAllEntries: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  getPromptForDate: vi.fn().mockReturnValue("What impact did you make today?"),
}));

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Journal tab by default", () => {
    render(<App />);
    expect(
      screen.getByText("What impact did you make today?")
    ).toBeInTheDocument();
  });

  it("switches to Brag Doc tab", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: "Brag Doc" }));
    expect(
      screen.getByText("Add some journal entries first")
    ).toBeInTheDocument();
  });

  it("switches to Settings tab", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(
      screen.getByRole("button", { name: "Clear all data" })
    ).toBeInTheDocument();
  });

  it("highlights active tab", async () => {
    render(<App />);
    const journalTab = screen.getByRole("tab", { name: "Journal" });
    expect(journalTab.style.borderBottom).toContain("solid");
    expect(journalTab.style.color).toBeTruthy();
  });
});
