import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPicker } from "./TagPicker";

describe("TagPicker", () => {
  it("renders all tags", () => {
    render(<TagPicker selected={[]} onChange={() => {}} />);
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
    expect(screen.getByText("collaboration")).toBeInTheDocument();
    expect(screen.getByText("problem-solving")).toBeInTheDocument();
    expect(screen.getByText("communication")).toBeInTheDocument();
    expect(screen.getByText("mentoring")).toBeInTheDocument();
  });

  it("toggles a tag on click", async () => {
    const onChange = vi.fn();
    render(<TagPicker selected={[]} onChange={onChange} />);
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith(["leadership"]);
  });

  it("removes a tag when already selected", async () => {
    const onChange = vi.fn();
    render(<TagPicker selected={["leadership"]} onChange={onChange} />);
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("visually distinguishes selected tags", () => {
    render(<TagPicker selected={["technical"]} onChange={() => {}} />);
    const tag = screen.getByText("technical");
    expect(tag.className).toMatch(/bg-purple/);
  });
});
