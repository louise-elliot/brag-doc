import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryList } from "./EntryList";
import type { Entry } from "@/lib/types";

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
    render(<EntryList entries={entries} />);
    expect(screen.getByText("Led the architecture review")).toBeInTheDocument();
    expect(screen.getByText("Shipped the new dashboard")).toBeInTheDocument();
  });

  it("shows tags for each entry", () => {
    render(<EntryList entries={entries} />);
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("toggles reframed version visibility", async () => {
    render(<EntryList entries={entries} />);
    const toggle = screen.getByText("Show reframed");
    await userEvent.click(toggle);
    expect(
      screen.getByText("Drove architectural decisions for the team")
    ).toBeInTheDocument();
  });

  it("does not show toggle when no reframed version exists", () => {
    render(<EntryList entries={[entries[1]]} />);
    expect(screen.queryByText("Show reframed")).not.toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    render(<EntryList entries={[]} />);
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });
});
