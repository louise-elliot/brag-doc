import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BragDoc } from "./BragDoc";
import type { Entry } from "@/lib/types";
import type { TagDef } from "@/lib/tags";
import { writeSettings } from "@/lib/settings";

const TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
  { name: "technical", color: "#6B8AE0" },
];

const entries: Entry[] = [
  {
    id: "1",
    date: "2026-04-01",
    prompt: "What impact?",
    original: "Led the review",
    reframed: null,
    tags: ["leadership"],
    createdAt: "2026-04-01T18:00:00Z",
    coachNotes: null,
  },
];

function renderBragDoc(overrides: Partial<Parameters<typeof BragDoc>[0]> = {}) {
  const props = {
    entries,
    tags: TAGS,
    ...overrides,
  };
  render(<BragDoc {...props} />);
  return props;
}

describe("BragDoc — controls", () => {
  it("shows generate button", () => {
    renderBragDoc();
    expect(
      screen.getByRole("button", { name: "Generate" })
    ).toBeInTheDocument();
  });

  it("shows timeframe and organise-by segmented controls", () => {
    renderBragDoc();
    expect(
      screen.getByRole("radiogroup", { name: "Timeframe" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Organise by" })
    ).toBeInTheDocument();
  });

  it("renders a tag chip per tag plus an Untagged chip", () => {
    renderBragDoc();
    expect(
      screen.getByRole("button", { name: "leadership", pressed: true })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "technical", pressed: true })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Untagged", pressed: true })
    ).toBeInTheDocument();
  });

  it("disables Generate and shows helper text when every tag chip is deselected", async () => {
    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "leadership" }));
    await userEvent.click(screen.getByRole("button", { name: "technical" }));
    await userEvent.click(screen.getByRole("button", { name: "Untagged" }));
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByText("Select at least one tag")).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    renderBragDoc({ entries: [] });
    expect(
      screen.getByText("Add some journal entries first")
    ).toBeInTheDocument();
  });
});

describe("BragDoc — generate payload", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [{ tag: "leadership", points: ["Drove decisions"] }],
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("sends groupBy='tag' by default", async () => {
    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(screen.getByText("Drove decisions")).toBeInTheDocument()
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.groupBy).toBe("tag");
    expect(body.userPrompt).toBeUndefined();
  });

  it("sends the chosen groupBy when a segmented option is selected", async () => {
    renderBragDoc();
    const groupByGroup = screen.getByRole("radiogroup", {
      name: "Organise by",
    });
    await userEvent.click(
      within(groupByGroup).getByRole("radio", { name: "Month" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.groupBy).toBe("month");
  });

  it("includes a trimmed userPrompt when provided", async () => {
    renderBragDoc();
    await userEvent.type(
      screen.getByLabelText("Additional guidance"),
      "  focus on cross-functional impact  "
    );
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.userPrompt).toBe("focus on cross-functional impact");
  });

  it("filters out entries whose tags are all deselected", async () => {
    const e: Entry[] = [
      { ...entries[0], id: "a", tags: ["leadership"] },
      { ...entries[0], id: "b", tags: ["technical"] },
    ];
    renderBragDoc({ entries: e });
    await userEvent.click(screen.getByRole("button", { name: "technical" }));
    await userEvent.click(screen.getByRole("button", { name: "Untagged" }));
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe("a");
  });

  it("includes untagged entries only when the Untagged chip is selected", async () => {
    const e: Entry[] = [
      { ...entries[0], id: "tagged", tags: ["leadership"] },
      { ...entries[0], id: "untagged", tags: [] },
    ];
    renderBragDoc({ entries: e });
    // Deselect "Untagged"
    await userEvent.click(screen.getByRole("button", { name: "Untagged" }));
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.entries.map((x: Entry) => x.id)).toEqual(["tagged"]);
  });
});

describe("BragDoc — output rendering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("displays generated bullets", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [
            { tag: "leadership", points: ["Drove architectural decisions"] },
          ],
        }),
    });

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(
        screen.getByText("Drove architectural decisions")
      ).toBeInTheDocument()
    );
  });

  it("hides the group heading when tag is an empty string (chronological)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [{ tag: "", points: ["First point", "Second point"] }],
        }),
    });

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(screen.getByText("First point")).toBeInTheDocument()
    );
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("copies without a heading for empty-tag groups", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [{ tag: "", points: ["only point"] }],
        }),
    });

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(screen.getByText("only point")).toBeInTheDocument()
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Copy to clipboard" })
    );
    expect(writeText).toHaveBeenCalledWith("- only point");
  });

  it("copies to clipboard with tag headings when tags are present", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [{ tag: "leadership", points: ["Drove decisions"] }],
        }),
    });

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(screen.getByText("Drove decisions")).toBeInTheDocument()
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Copy to clipboard" })
    );
    expect(writeText).toHaveBeenCalledWith("LEADERSHIP\n- Drove decisions");
  });

  it("shows error on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "API error" }),
    });

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(
        screen.getByText("Failed to generate brag doc. Please try again.")
      ).toBeInTheDocument()
    );
  });

  it("clears loading and shows an error when fetch rejects", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(
        screen.getByText("Failed to generate brag doc. Please try again.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("shows an error and does NOT mark as copied if clipboard write rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    Object.assign(navigator, { clipboard: { writeText } });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bullets: [{ tag: "leadership", points: ["Drove decisions"] }],
        }),
    });

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(screen.getByText("Drove decisions")).toBeInTheDocument()
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Copy to clipboard" })
    );
    await waitFor(() =>
      expect(
        screen.getByText("Could not copy to clipboard.")
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("button", { name: "Copied" })
    ).not.toBeInTheDocument();
  });
});

describe("BragDoc — user_context forwarding", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ bullets: [] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("sends serialized user_context with the generate request", async () => {
    writeSettings({
      contextHeadline: "Staff engineer",
      contextNotes: "Promo case to principal",
    });
    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.user_context).toEqual({
      headline: "Staff engineer",
      notes: "Promo case to principal",
    });
  });

  it("sends user_context: null when no context is set", async () => {
    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.user_context).toBeNull();
  });
});
