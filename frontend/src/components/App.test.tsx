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
  deleteEntry: vi.fn(),
  editEntry: vi.fn(),
  renameTagOnEntries: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  getPromptForDate: vi.fn().mockReturnValue("What impact did you make today?"),
  getRandomPromptExcluding: vi.fn().mockReturnValue("What challenge did you navigate?"),
}));

vi.mock("@/lib/tags", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tags")>("@/lib/tags");
  return {
    ...actual,
    getTags: vi.fn().mockReturnValue([
      { name: "leadership", color: "#D4863C" },
      { name: "technical", color: "#6B8AE0" },
    ]),
    saveTags: vi.fn(),
  };
});

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

  it("exposes ARIA tablist/tabpanel semantics", async () => {
    render(<App />);
    // nav wrapper
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    // Journal tab links to its panel via aria-controls
    const journalTab = screen.getByRole("tab", { name: "Journal" });
    const panelId = journalTab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute("role")).toBe("tabpanel");
    expect(panel!.getAttribute("aria-labelledby")).toBe(journalTab.id);
  });

  it("refresh-prompt button swaps the prompt to a new one", async () => {
    render(<App />);
    expect(
      screen.getByText("What impact did you make today?")
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Try another prompt" })
    );
    expect(
      screen.getByText("What challenge did you navigate?")
    ).toBeInTheDocument();
  });

  it("save → reframe → accept overwrites the stored entry's original text", async () => {
    // Bring the mocked updateEntry into scope so we can assert on it.
    const { updateEntry } = await import("@/lib/entries");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reframed: "Led the release" }),
    });

    render(<App />);
    const textarea = screen.getByPlaceholderText("Write about your win...");
    await userEvent.type(textarea, "I helped with the release");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    // Wait for ReframeView to appear (identified by its Accept button)
    await screen.findByRole("button", { name: "Accept" });
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    // Accept seeded from the reframed text, no edits made
    expect(updateEntry).toHaveBeenLastCalledWith("1", {
      original: "Led the release",
      reframed: "Led the release",
    });
  });
});
