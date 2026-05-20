import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPicker } from "./TagPicker";
import type { TagDef } from "@/lib/tags";

const TAGS: TagDef[] = [
  { name: "leadership" },
  { name: "technical" },
  { name: "collaboration" },
  { name: "problem-solving" },
  { name: "communication" },
  { name: "mentoring" },
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

  it("marks selected tags with aria-pressed", () => {
    render(
      <TagPicker tags={TAGS} selected={["technical"]} onChange={() => {}} />
    );
    expect(screen.getByText("technical").getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByText("leadership").getAttribute("aria-pressed")).toBe(
      "false"
    );
  });
});
