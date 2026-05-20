import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryList } from "./EntryList";
import type { Entry } from "@/lib/types";
import type { TagDef } from "@/lib/tags";

vi.mock("./CoachPanel", () => ({
  CoachPanel: vi.fn(() => <div data-testid="mock-coach-panel">coach panel</div>),
}));

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
    coachNotes: ["minimising-language"],
  },
  {
    id: "2",
    date: "2026-03-31",
    prompt: "What did you ship?",
    original: "Shipped the new dashboard",
    reframed: null,
    tags: ["technical"],
    createdAt: "2026-03-31T18:00:00Z",
    coachNotes: null,
  },
];

function renderList(overrides: Partial<Parameters<typeof EntryList>[0]> = {}) {
  const props = {
    entries,
    tags: TAGS,
    onEditEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
    onCoachAccept: vi.fn(),
    onCoachDismiss: vi.fn(),
    ...overrides,
  };
  render(<EntryList {...props} />);
  return props;
}

describe("EntryList", () => {
  it("renders the reframed version by default when present, and the original when not", () => {
    renderList();
    expect(
      screen.getByText("Drove architectural decisions for the team")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Led the architecture review")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Shipped the new dashboard")).toBeInTheDocument();
  });

  it("shows tags for each entry", () => {
    renderList();
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("toggles original visibility for a reframed entry", async () => {
    renderList();
    expect(
      screen.queryByText("Led the architecture review")
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Show original"));
    expect(
      screen.getByText("Led the architecture review")
    ).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    renderList({ entries: [] });
    expect(screen.getByText("No wins yet")).toBeInTheDocument();
    expect(
      screen.getByText("They'll be here when you're ready.")
    ).toBeInTheDocument();
  });

  it("falls back to neutral styling for tags no longer in the tags list", () => {
    const entry: Entry = { ...entries[0], tags: ["deleted-tag"] };
    renderList({ entries: [entry] });
    // Tag chip should render without crashing even when not in the tag definitions
    expect(screen.getByText("deleted-tag")).toBeInTheDocument();
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
  it("pre-fills with the reframed text when one exists", async () => {
    renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[0]
    );
    const textarea = screen.getByRole("textbox", { name: "Edit entry text" });
    expect(textarea).toHaveValue("Drove architectural decisions for the team");
  });

  it("pre-fills with the original text when no reframed exists", async () => {
    renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[1]
    );
    const textarea = screen.getByRole("textbox", { name: "Edit entry text" });
    expect(textarea).toHaveValue("Shipped the new dashboard");
  });

  it("saves edits to the reframed field when a reframed version exists", async () => {
    const { onEditEntry } = renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[0]
    );
    const textarea = screen.getByRole("textbox", { name: "Edit entry text" });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "  Drove architectural decisions across teams  ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEditEntry).toHaveBeenCalledWith("1", {
      reframed: "Drove architectural decisions across teams",
      tags: ["leadership"],
    });
  });

  it("saves edits to the original field when no reframed exists", async () => {
    const { onEditEntry } = renderList();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Edit entry" })[1]
    );
    const textarea = screen.getByRole("textbox", { name: "Edit entry text" });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Shipped the new dashboard (v2)");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEditEntry).toHaveBeenCalledWith("2", {
      original: "Shipped the new dashboard (v2)",
      tags: ["technical"],
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

const baseCoachEntry: Entry = {
  id: "e1",
  date: "2026-04-01",
  prompt: "What did you ship?",
  original: "Led the migration",
  reframed: null,
  tags: ["technical"],
  createdAt: "2026-04-01T18:00:00Z",
  coachNotes: null,
};

const renderCoachList = (items: Entry[]) =>
  render(
    <EntryList
      entries={items}
      tags={[{ name: "technical", color: "#6B8AE0" }]}
      onEditEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
      onCoachAccept={vi.fn()}
      onCoachDismiss={vi.fn()}
    />
  );

describe("EntryList — coach affordance", () => {
  it("shows the Talk-it-through button when coachNotes is null", () => {
    renderCoachList([baseCoachEntry]);
    expect(
      screen.getByRole("button", { name: /coach me/i })
    ).toBeInTheDocument();
  });

  it("hides the Talk-it-through button when coachNotes is an empty array", () => {
    renderCoachList([{ ...baseCoachEntry, coachNotes: [] }]);
    expect(
      screen.queryByRole("button", { name: /coach me/i })
    ).not.toBeInTheDocument();
  });

  it("hides the Talk-it-through button when coachNotes is populated", () => {
    renderCoachList([{ ...baseCoachEntry, coachNotes: ["minimising-language"] }]);
    expect(
      screen.queryByRole("button", { name: /coach me/i })
    ).not.toBeInTheDocument();
  });

  it("renders coach-note pills inside the expanded original view", async () => {
    renderCoachList([
      {
        ...baseCoachEntry,
        reframed: "Drove the migration end to end",
        coachNotes: ["minimising-language", "missing-metrics"],
      },
    ]);
    expect(screen.queryByText("minimising-language")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Show original"));
    expect(screen.getByText("minimising-language")).toBeInTheDocument();
    expect(screen.getByText("missing-metrics")).toBeInTheDocument();
  });

  it("does not render the pill row when coachNotes is empty array", () => {
    renderCoachList([{ ...baseCoachEntry, coachNotes: [] }]);
    expect(screen.queryByText("minimising-language")).not.toBeInTheDocument();
  });

  it("mounts CoachPanel when Talk-it-through is clicked", async () => {
    renderCoachList([baseCoachEntry]);
    expect(screen.queryByTestId("mock-coach-panel")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /coach me/i })
    );
    expect(screen.getByTestId("mock-coach-panel")).toBeInTheDocument();
  });

  it("only one CoachPanel is open across multiple entries", async () => {
    const second: Entry = { ...baseCoachEntry, id: "e2", date: "2026-04-02" };
    renderCoachList([baseCoachEntry, second]);

    const buttons = screen.getAllByRole("button", { name: /coach me/i });
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);

    expect(screen.getAllByTestId("mock-coach-panel")).toHaveLength(1);
  });
});
