import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "./Settings";
import type { TagDef } from "@/lib/tags";

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
  { name: "technical", color: "#6B8AE0" },
];

function renderSettings(overrides: Partial<Parameters<typeof Settings>[0]> = {}) {
  const props = {
    tags: DEFAULT_TAGS,
    onAddTag: vi.fn(),
    onDeleteTag: vi.fn(),
    onRenameTag: vi.fn(),
    onClearData: vi.fn(),
    ...overrides,
  };
  render(<Settings {...props} />);
  return props;
}

describe("Settings — Data Management card", () => {
  it("shows clear data button", () => {
    renderSettings();
    expect(
      screen.getByRole("button", { name: "Clear all data" })
    ).toBeInTheDocument();
  });

  it("shows confirmation dialog on click", async () => {
    renderSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    expect(
      screen.getByText("This will permanently delete all your journal entries.")
    ).toBeInTheDocument();
  });

  it("calls onClearData when confirmed", async () => {
    const { onClearData } = renderSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" })
    );
    expect(onClearData).toHaveBeenCalled();
  });

  it("cancels without clearing", async () => {
    const { onClearData } = renderSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClearData).not.toHaveBeenCalled();
    expect(
      screen.queryByText("This will permanently delete all your journal entries.")
    ).not.toBeInTheDocument();
  });
});

describe("Settings — Categories card", () => {
  it("renders one row per tag with its color swatch", () => {
    renderSettings();
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no categories", () => {
    renderSettings({ tags: [] });
    expect(
      screen.getByText("No categories yet — add one below.")
    ).toBeInTheDocument();
  });

  it("Add button is disabled until a non-empty name is entered", async () => {
    renderSettings();
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("New category name"),
      "focus"
    );
    expect(addButton).toBeEnabled();
  });

  it("Add button is disabled when the name duplicates an existing tag (case-insensitive)", async () => {
    renderSettings();
    await userEvent.type(
      screen.getByLabelText("New category name"),
      "Leadership"
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(
      screen.getByText("A category with this name already exists.")
    ).toBeInTheDocument();
  });

  it("calls onAddTag with the trimmed name and selected color", async () => {
    const { onAddTag } = renderSettings();
    await userEvent.type(
      screen.getByLabelText("New category name"),
      "  focus  "
    );
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAddTag).toHaveBeenCalledTimes(1);
    expect(onAddTag).toHaveBeenCalledWith("focus", expect.stringMatching(/^#/));
  });

  it("calls onDeleteTag when the × button is clicked", async () => {
    const { onDeleteTag } = renderSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete leadership" })
    );
    expect(onDeleteTag).toHaveBeenCalledWith("leadership");
  });

  it("calls onRenameTag after inline edit and Enter", async () => {
    const { onRenameTag } = renderSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename leadership" })
    );
    const input = screen.getByLabelText("Rename leadership");
    await userEvent.clear(input);
    await userEvent.type(input, "leading{Enter}");
    expect(onRenameTag).toHaveBeenCalledWith("leadership", "leading");
  });

  it("does not call onRenameTag when rename is a no-op (same name)", async () => {
    const { onRenameTag } = renderSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename leadership" })
    );
    const input = screen.getByLabelText("Rename leadership");
    await userEvent.type(input, "{Enter}");
    expect(onRenameTag).not.toHaveBeenCalled();
  });

  it("does not call onRenameTag when new name duplicates another tag", async () => {
    const { onRenameTag } = renderSettings();
    await userEvent.click(
      screen.getByRole("button", { name: "Rename leadership" })
    );
    const input = screen.getByLabelText("Rename leadership");
    await userEvent.clear(input);
    await userEvent.type(input, "technical{Enter}");
    expect(onRenameTag).not.toHaveBeenCalled();
  });
});
