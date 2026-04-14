import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryForm } from "./EntryForm";

describe("EntryForm", () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  it("displays the prompt", () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    expect(
      screen.getByText("What impact did you make today?")
    ).toBeInTheDocument();
  });

  it("submits entry with text and tags", async () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    await userEvent.type(
      screen.getByPlaceholderText("Write about your win..."),
      "Led the design review"
    );
    await userEvent.click(screen.getByText("leadership"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockOnSave).toHaveBeenCalledWith({
      original: "Led the design review",
      tags: ["leadership"],
    });
  });

  it("clears form after save", async () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    const textarea = screen.getByPlaceholderText("Write about your win...");
    await userEvent.type(textarea, "Something great");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(textarea).toHaveValue("");
  });

  it("disables save when text is empty", () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
