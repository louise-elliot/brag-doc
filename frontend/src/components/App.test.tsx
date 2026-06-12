import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { DEFAULT_USER_SETTINGS } from "@/lib/types";

const MOCK_ENTRY = {
  id: "entry-1",
  date: "2026-04-01",
  prompt: "What impact?",
  original: "Test entry",
  reframed: null,
  tags: [],
  createdAt: "2026-04-01T18:00:00Z",
  coachNotes: null,
};

vi.mock("@/lib/entries", () => ({
  getEntries: vi.fn(() => Promise.resolve([])),
  addEntry: vi.fn(() => Promise.resolve(MOCK_ENTRY)),
  updateEntry: vi.fn(() => Promise.resolve()),
  deleteAllEntries: vi.fn(() => Promise.resolve()),
  deleteEntry: vi.fn(() => Promise.resolve()),
  editEntry: vi.fn(() => Promise.resolve()),
  renameTagOnEntries: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/settings", () => ({
  readSettings: vi.fn(() =>
    Promise.resolve({ ...DEFAULT_USER_SETTINGS, aiConsent: false })
  ),
  writeSettings: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/migration", () => ({
  runFirstSignInMigration: vi.fn(() => Promise.resolve("skipped-returning-user")),
}));

vi.mock("@/lib/prompts", () => ({
  getPromptForDate: vi.fn().mockReturnValue("What impact did you make today?"),
  getRandomPromptExcluding: vi.fn().mockReturnValue("What challenge did you navigate?"),
}));

vi.mock("@/lib/tags", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tags")>("@/lib/tags");
  return {
    ...actual,
    getTags: vi.fn(() =>
      Promise.resolve([{ name: "leadership" }, { name: "technical" }])
    ),
    saveTags: vi.fn(() => Promise.resolve()),
  };
});

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Journal tab by default", async () => {
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByText("What impact did you make today?")
      ).toBeInTheDocument()
    );
  });

  it("switches to Brag Doc tab", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: /brag doc/i }));
    expect(
      screen.getByText("Add some journal entries first")
    ).toBeInTheDocument();
  });

  it("opens settings drawer when cog button is clicked", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /open settings/i }));
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });

  it("highlights active tab", async () => {
    render(<App />);
    const journalTab = screen.getByRole("tab", { name: /daily wins/i });
    // Styling moved from inline styles to className; verify semantic state instead.
    expect(journalTab).toHaveAttribute("aria-selected", "true");
    const bragDocTab = screen.getByRole("tab", { name: /brag doc/i });
    expect(bragDocTab).toHaveAttribute("aria-selected", "false");
  });

  it("exposes ARIA tablist/tabpanel semantics", async () => {
    render(<App />);
    // nav wrapper
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    // Journal tab links to its panel via aria-controls
    const journalTab = screen.getByRole("tab", { name: /daily wins/i });
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

  it("save persists the entry without triggering any AI call", async () => {
    const { addEntry } = await import("@/lib/entries");

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    render(<App />);
    const textarea = await screen.findByPlaceholderText("Write about your win...");
    await userEvent.type(textarea, "I helped with the release");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(addEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          original: "I helped with the release",
          coachNotes: null,
          reframed: null,
        })
      )
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the consent gate when Coach me is clicked without prior consent", async () => {
    const { getEntries } = await import("@/lib/entries");
    vi.mocked(getEntries).mockResolvedValue([MOCK_ENTRY]);

    render(<App />);
    const coachButton = (await screen.findAllByRole("button", { name: "Coach me" }))[0];
    fireEvent.click(coachButton);
    expect(
      await screen.findByRole("button", { name: /i understand, continue/i })
    ).toBeInTheDocument();
  });
});
