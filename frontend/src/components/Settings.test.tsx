import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriesCard, CoachingStyleCard, ContextCard, DataCard } from "./Settings";
import type { TagDef } from "@/lib/tags";
import { readSettings } from "@/lib/settings";

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
  { name: "technical", color: "#6B8AE0" },
];

describe("Settings — Data Management card", () => {
  it("shows clear data button", () => {
    render(
      <DataCard
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onClearData={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Clear all data" })
    ).toBeInTheDocument();
  });

  it("shows confirmation dialog on click", async () => {
    render(
      <DataCard
        confirming={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onClearData={vi.fn()}
      />
    );
    expect(
      screen.getByText("This will permanently delete all your journal entries.")
    ).toBeInTheDocument();
  });

  it("calls onClearData when confirmed", async () => {
    const onClearData = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DataCard
        confirming={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        onClearData={onClearData}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    expect(onConfirm).toHaveBeenCalled();

    rerender(
      <DataCard
        confirming={true}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        onClearData={onClearData}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" })
    );
    expect(onClearData).toHaveBeenCalled();
  });

  it("cancels without clearing", async () => {
    const onClearData = vi.fn();
    const onCancel = vi.fn();
    render(
      <DataCard
        confirming={true}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        onClearData={onClearData}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onClearData).not.toHaveBeenCalled();
  });
});

describe("Settings — Categories card", () => {
  it("renders one row per tag", () => {
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={vi.fn()}
      />
    );
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no categories", () => {
    render(
      <CategoriesCard
        tags={[]}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={vi.fn()}
      />
    );
    expect(
      screen.getByText("No categories yet — add one below.")
    ).toBeInTheDocument();
  });

  it("Add button is disabled until a non-empty name is entered", async () => {
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={vi.fn()}
      />
    );
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("New category name"),
      "focus"
    );
    expect(addButton).toBeEnabled();
  });

  it("Add button is disabled when the name duplicates an existing tag (case-insensitive)", async () => {
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={vi.fn()}
      />
    );
    await userEvent.type(
      screen.getByLabelText("New category name"),
      "Leadership"
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(
      screen.getByText("A category with this name already exists.")
    ).toBeInTheDocument();
  });

  it("calls onAddTag with the trimmed name", async () => {
    const onAddTag = vi.fn();
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={onAddTag}
        onDeleteTag={vi.fn()}
        onRenameTag={vi.fn()}
      />
    );
    await userEvent.type(
      screen.getByLabelText("New category name"),
      "  focus  "
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAddTag).toHaveBeenCalledTimes(1);
    expect(onAddTag).toHaveBeenCalledWith("focus");
  });

  it("calls onDeleteTag when the Delete button is clicked", async () => {
    const onDeleteTag = vi.fn();
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={vi.fn()}
        onDeleteTag={onDeleteTag}
        onRenameTag={vi.fn()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Delete leadership" })
    );
    expect(onDeleteTag).toHaveBeenCalledWith("leadership");
  });

  it("calls onRenameTag after inline edit and Enter", async () => {
    const onRenameTag = vi.fn();
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={onRenameTag}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Rename leadership" })
    );
    const input = screen.getByLabelText("Rename leadership");
    await userEvent.clear(input);
    await userEvent.type(input, "leading{Enter}");
    expect(onRenameTag).toHaveBeenCalledWith("leadership", "leading");
  });

  it("does not call onRenameTag when rename is a no-op (same name)", async () => {
    const onRenameTag = vi.fn();
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={onRenameTag}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Rename leadership" })
    );
    const input = screen.getByLabelText("Rename leadership");
    await userEvent.type(input, "{Enter}");
    expect(onRenameTag).not.toHaveBeenCalled();
  });

  it("does not call onRenameTag when new name duplicates another tag", async () => {
    const onRenameTag = vi.fn();
    render(
      <CategoriesCard
        tags={DEFAULT_TAGS}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={onRenameTag}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Rename leadership" })
    );
    const input = screen.getByLabelText("Rename leadership");
    await userEvent.clear(input);
    await userEvent.type(input, "technical{Enter}");
    expect(onRenameTag).not.toHaveBeenCalled();
  });
});

describe("Settings — Coaching Style card", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders all four coaching styles with labels", () => {
    render(<CoachingStyleCard />);
    expect(screen.getByText("The Trusted Mentor")).toBeInTheDocument();
    expect(screen.getByText("The Hype Woman")).toBeInTheDocument();
    expect(screen.getByText("The Direct Challenger")).toBeInTheDocument();
    expect(screen.getByText("The Bold Coach")).toBeInTheDocument();
  });

  it("marks The Trusted Mentor as selected by default", () => {
    render(<CoachingStyleCard />);
    const radio = screen.getByRole("radio", { name: /the trusted mentor/i });
    expect(radio).toHaveAttribute("aria-checked", "true");
  });

  it("persists a different style on click", async () => {
    render(<CoachingStyleCard />);
    await userEvent.click(
      screen.getByRole("radio", { name: /the hype woman/i })
    );
    expect(readSettings().coachingStyle).toBe("hype-woman");
  });

  it("hydrates the selected style from localStorage on mount", () => {
    localStorage.setItem(
      "byline-settings",
      JSON.stringify({ coachingStyle: "bold-coach" })
    );
    render(<CoachingStyleCard />);
    const radio = screen.getByRole("radio", { name: /the bold coach/i });
    expect(radio).toHaveAttribute("aria-checked", "true");
  });
});

describe("Settings — Your Context card", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the headline input and notes textarea", () => {
    render(<ContextCard />);
    expect(
      screen.getByRole("textbox", { name: /job title/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /what else do you want your coach to know/i })
    ).toBeInTheDocument();
  });

  it("persists the headline on blur", async () => {
    render(<ContextCard />);
    const headline = screen.getByRole("textbox", { name: /job title/i });
    await userEvent.type(headline, "Senior backend engineer");
    headline.blur();
    expect(readSettings().contextHeadline).toBe("Senior backend engineer");
  });

  it("persists the notes textarea on blur", async () => {
    render(<ContextCard />);
    const notes = screen.getByRole("textbox", {
      name: /what else do you want your coach to know/i,
    });
    await userEvent.type(notes, "Working towards staff");
    notes.blur();
    expect(readSettings().contextNotes).toBe("Working towards staff");
  });

  it("hydrates both fields from localStorage on mount", () => {
    localStorage.setItem(
      "byline-settings",
      JSON.stringify({
        contextHeadline: "Stored headline",
        contextNotes: "Stored notes",
      })
    );
    render(<ContextCard />);
    expect(screen.getByRole("textbox", { name: /job title/i })).toHaveValue(
      "Stored headline"
    );
    expect(
      screen.getByRole("textbox", { name: /what else do you want your coach to know/i })
    ).toHaveValue("Stored notes");
  });
});
