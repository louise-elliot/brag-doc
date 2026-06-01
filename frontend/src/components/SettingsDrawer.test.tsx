import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDrawer } from "./SettingsDrawer";
import type { TagDef } from "@/lib/tags";

vi.mock("@/lib/settings", () => ({
  readSettings: vi.fn().mockReturnValue({
    coachingStyle: "trusted-mentor",
    contextHeadline: "",
    contextNotes: "",
  }),
  writeSettings: vi.fn(),
}));

vi.mock("@/lib/tags", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tags")>("@/lib/tags");
  return {
    ...actual,
    getTags: vi.fn().mockReturnValue([]),
    saveTags: vi.fn(),
  };
});

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
];

function renderDrawer(open: boolean, overrides: Partial<Parameters<typeof SettingsDrawer>[0]> = {}) {
  const props = {
    open,
    onClose: vi.fn(),
    tags: DEFAULT_TAGS,
    onAddTag: vi.fn(),
    onDeleteTag: vi.fn(),
    onRenameTag: vi.fn(),
    onClearData: vi.fn(),
    ...overrides,
  };
  const result = render(<SettingsDrawer {...props} />);
  return { ...result, props };
}

describe("SettingsDrawer", () => {
  it("renders nothing when closed", () => {
    renderDrawer(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with role=dialog and aria-modal when open", () => {
    renderDrawer(true);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("close button calls onClose", async () => {
    const { props } = renderDrawer(true);
    const closeButtons = screen.getAllByRole("button", { name: /close settings/i });
    await userEvent.click(closeButtons[0]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("Escape key calls onClose", () => {
    const { props } = renderDrawer(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("backdrop click calls onClose", async () => {
    const { props, container } = renderDrawer(true);
    // The backdrop is the full-screen button behind the drawer panel
    const backdrop = container.querySelector<HTMLButtonElement>(
      'button.absolute.inset-0'
    )!;
    expect(backdrop).not.toBeNull();
    await userEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("default active tab is You — shows ContextCard content", () => {
    renderDrawer(true);
    expect(screen.getByRole("textbox", { name: /job title/i })).toBeInTheDocument();
  });

  it("clicking Coach tab shows CoachingStyleCard content", async () => {
    renderDrawer(true);
    await userEvent.click(screen.getByRole("tab", { name: "Coach" }));
    expect(screen.getByRole("radiogroup", { name: /coach persona/i })).toBeInTheDocument();
  });

  it("clicking Data tab shows CategoriesCard and DataCard content", async () => {
    renderDrawer(true);
    await userEvent.click(screen.getByRole("tab", { name: "Data" }));
    expect(screen.getByRole("button", { name: "Clear all data" })).toBeInTheDocument();
    expect(screen.getByLabelText("New category name")).toBeInTheDocument();
  });
});
