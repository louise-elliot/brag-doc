import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BragDoc } from "./BragDoc";
import type { Entry } from "@/lib/types";

const entries: Entry[] = [
  {
    id: "1",
    date: "2026-04-01",
    prompt: "What impact?",
    original: "Led the review",
    reframed: null,
    tags: ["leadership"],
    createdAt: "2026-04-01T18:00:00Z",
  },
];

describe("BragDoc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows generate button", () => {
    render(<BragDoc entries={entries} />);
    expect(
      screen.getByRole("button", { name: "Generate" })
    ).toBeInTheDocument();
  });

  it("shows date range filter", () => {
    render(<BragDoc entries={entries} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("displays generated bullets", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [
            {
              tag: "leadership",
              points: ["Drove architectural decisions"],
            },
          ],
        }),
    });

    render(<BragDoc entries={entries} />);
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(
        screen.getByText("Drove architectural decisions")
      ).toBeInTheDocument();
    });
  });

  it("copies to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [
            { tag: "leadership", points: ["Drove decisions"] },
          ],
        }),
    });

    render(<BragDoc entries={entries} />);
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(screen.getByText("Drove decisions")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Copy to clipboard" })
    );
    expect(writeText).toHaveBeenCalled();
  });

  it("shows error on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "API error" }),
    });

    render(<BragDoc entries={entries} />);
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to generate brag doc. Please try again.")
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no entries", () => {
    render(<BragDoc entries={[]} />);
    expect(
      screen.getByText("Add some journal entries first")
    ).toBeInTheDocument();
  });
});
