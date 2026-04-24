import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryList } from "./EntryList";
import type { Entry } from "@/lib/types";
import type { TagDef } from "@/lib/tags";

const TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
  { name: "technical", color: "#6B8AE0" },
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

describe("EntryList", () => {
  it("renders all entries", () => {
    render(<EntryList entries={entries} tags={TAGS} />);
    expect(screen.getByText("Led the architecture review")).toBeInTheDocument();
    expect(screen.getByText("Shipped the new dashboard")).toBeInTheDocument();
  });

  it("shows tags for each entry", () => {
    render(<EntryList entries={entries} tags={TAGS} />);
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("toggles reframed version visibility", async () => {
    render(<EntryList entries={entries} tags={TAGS} />);
    const toggle = screen.getByText("Show reframed");
    await userEvent.click(toggle);
    expect(
      screen.getByText("Drove architectural decisions for the team")
    ).toBeInTheDocument();
  });

  it("does not show toggle when no reframed version exists", () => {
    render(<EntryList entries={[entries[1]]} tags={TAGS} />);
    expect(screen.queryByText("Show reframed")).not.toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    render(<EntryList entries={[]} tags={TAGS} />);
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });

  it("falls back to neutral styling when a tag on an entry is no longer in the tags list", () => {
    const entry: Entry = {
      ...entries[0],
      tags: ["deleted-tag"],
    };
    render(<EntryList entries={[entry]} tags={TAGS} />);
    const chip = screen.getByText("deleted-tag");
    expect(chip).toBeInTheDocument();
    // Neutral border/background path: inline style uses --color-border / --color-surface
    expect(chip.style.border).toContain("var(--color-border)");
  });
});
