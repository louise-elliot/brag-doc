import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryList } from "./EntryList";
import type { Entry } from "@/lib/types";
import type { TagDef } from "@/lib/tags";

const TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
  { name: "technical", color: "#6B8AE0" },
  { name: "mentoring", color: "#E07272" },
];

const entries: Entry[] = [
  {
    id: "1",
    date: "2026-04-01",
    prompt: "What impact did you make?",
    original: "Led the architecture review",
    reframed: "Drove architectural decisions for the team",
    tags: ["leadership"],
    createdAt: "2026-04-01T18:00:00Z",
  },
  {
    id: "2",
    date: "2026-03-31",
    prompt: "What did you ship?",
    original: "Shipped the new dashboard",
    reframed: null,
    tags: ["technical"],
    createdAt: "2026-03-31T18:00:00Z",
  },
];

function renderList(overrides: Partial<Parameters<typeof EntryList>[0]> = {}) {
  const props = {
    entries,
    tags: TAGS,
    onEditEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
    onReframeAgain: vi.fn(),
    ...overrides,
  };
  render(<EntryList {...props} />);
  return props;
}

describe("EntryList", () => {
  it("renders all entries", () => {
    renderList();
    expect(screen.getByText("Led the architecture review")).toBeInTheDocument();
    expect(screen.getByText("Shipped the new dashboard")).toBeInTheDocument();
  });

  it("shows tags for each entry", () => {
    renderList();
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("toggles reframed version visibility", async () => {
    renderList();
    const toggle = screen.getByText("Show reframed");
    await userEvent.click(toggle);
    expect(
      screen.getByText("Drove architectural decisions for the team")
    ).toBeInTheDocument();
  });

  it("shows 'Reframe again' when an entry has no reframed version", () => {
    renderList();
    expect(screen.getByText("Reframe again")).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    renderList({ entries: [] });
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });

  it("falls back to neutral styling for tags no longer in the tags list", () => {
    const entry: Entry = { ...entries[0], tags: ["deleted-tag"] };
    renderList({ entries: [entry] });
    const chip = screen.getByText("deleted-tag");
    expect(chip.style.border).toContain("var(--color-border)");
  });

  it("renders Edit and Delete affordances on every row", () => {
    renderList();
    expect(screen.getAllByRole("button", { name: "Edit entry" })).toHaveLength(
      2
    );
    expect(
      screen.getAllByRole("button", { name: "Delete entry" })
    ).toHaveLength(2);
  });
});

describe("EntryList — edit flow", () => {
  it("enters edit mode when Edit is clicked and shows the textarea pre-filled", async () => {
    renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[0]
    );
    const textarea = screen.getByRole("textbox", { name: "Edit entry text" });
    expect(textarea).toHaveValue("Led the architecture review");
  });

  it("calls onEditEntry with trimmed text and current tags when Save is clicked", async () => {
    const { onEditEntry } = renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[0]
    );
    const textarea = screen.getByRole("textbox", { name: "Edit entry text" });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "  Led the architecture review (revised)  ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEditEntry).toHaveBeenCalledWith("1", {
      original: "Led the architecture review (revised)",
      tags: ["leadership"],
    });
  });

  it("disables Save when the textarea is empty", async () => {
    renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[0]
    );
    const textarea = screen.getByRole("textbox", { name: "Edit entry text" });
    await userEvent.clear(textarea);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("Cancel discards changes and exits edit mode", async () => {
    const { onEditEntry } = renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[0]
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onEditEntry).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", { name: "Edit entry text" })
    ).not.toBeInTheDocument();
  });

  it("opening a second row in edit mode cancels the first", async () => {
    renderList();
    const editButtons = screen.getAllByRole("button", { name: "Edit entry" });
    await userEvent.click(editButtons[0]);
    await userEvent.click(editButtons[1]);
    const textareas = screen.getAllByRole("textbox", {
      name: "Edit entry text",
    });
    expect(textareas).toHaveLength(1);
    expect(textareas[0]).toHaveValue("Shipped the new dashboard");
  });
});

describe("EntryList — delete flow", () => {
  it("shows inline confirm when Delete is clicked", async () => {
    renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Delete entry" })[0]
    );
    expect(
      screen.getByText("Delete this entry? It can't be undone.")
    ).toBeInTheDocument();
  });

  it("calls onDeleteEntry when 'Yes, delete' is clicked", async () => {
    const { onDeleteEntry } = renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Delete entry" })[0]
    );
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onDeleteEntry).toHaveBeenCalledWith("1");
  });

  it("Cancel closes the confirm strip without deleting", async () => {
    const { onDeleteEntry } = renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Delete entry" })[0]
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDeleteEntry).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Delete this entry? It can't be undone.")
    ).not.toBeInTheDocument();
  });
});

describe("EntryList — Reframe again", () => {
  it("calls onReframeAgain when the link is clicked", async () => {
    const onReframeAgain = vi.fn().mockResolvedValue(undefined);
    renderList({ onReframeAgain });
    await userEvent.click(screen.getByText("Reframe again"));
    expect(onReframeAgain).toHaveBeenCalledWith("2");
  });

  it("shows an inline error if onReframeAgain rejects", async () => {
    const onReframeAgain = vi.fn().mockRejectedValue(new Error("nope"));
    renderList({ onReframeAgain });
    await userEvent.click(screen.getByText("Reframe again"));
    expect(await screen.findByText("Could not reframe")).toBeInTheDocument();
  });
});
