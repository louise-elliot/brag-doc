import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPicker } from "./TagPicker";
import type { TagDef } from "@/lib/tags";

const TAGS: TagDef[] = [
  { name: "leadership", color: "#D4863C" },
  { name: "technical", color: "#6B8AE0" },
  { name: "collaboration", color: "#4CAF82" },
  { name: "problem-solving", color: "#C978D6" },
  { name: "communication", color: "#E0C46B" },
  { name: "mentoring", color: "#E07272" },
];

describe("TagPicker", () => {
  it("renders all tags from the provided list", () => {
    render(<TagPicker tags={TAGS} selected={[]} onChange={() => {}} />);
    TAGS.forEach((t) => {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    });
  });

  it("renders nothing when the tags list is empty", () => {
    const { container } = render(
      <TagPicker tags={[]} selected={[]} onChange={() => {}} />
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("toggles a tag on click", async () => {
    const onChange = vi.fn();
    render(<TagPicker tags={TAGS} selected={[]} onChange={onChange} />);
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith(["leadership"]);
  });

  it("removes a tag when already selected", async () => {
    const onChange = vi.fn();
    render(
      <TagPicker tags={TAGS} selected={["leadership"]} onChange={onChange} />
    );
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("visually distinguishes selected tags", () => {
    render(
      <TagPicker tags={TAGS} selected={["technical"]} onChange={() => {}} />
    );
    const tag = screen.getByText("technical");
    expect(tag.style.color).toBe("rgb(107, 138, 224)");
  });

  it("renders a user-added tag with its chosen color", () => {
    const custom: TagDef[] = [{ name: "focus", color: "#8AB4B8" }];
    render(
      <TagPicker tags={custom} selected={["focus"]} onChange={() => {}} />
    );
    const chip = screen.getByText("focus");
    expect(chip.style.color).toBe("rgb(138, 180, 184)");
  });
});
