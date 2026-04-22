import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

  it("clears the textarea after ~800ms (not immediately)", async () => {
    // shouldAdvanceTime lets userEvent's internal setTimeout(0) callbacks
    // resolve while fake timers are installed (vitest 4 + user-event 14)
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // userEvent needs its own timer config when fake timers are on
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    const textarea = screen.getByPlaceholderText("Write about your win...");
    await user.type(textarea, "Something great");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Not cleared immediately
    expect(textarea).toHaveValue("Something great");

    // After 800 ms it clears
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(textarea).toHaveValue("");

    vi.useRealTimers();
  });

  it("disables save when text is empty", () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("disables the Save button when saving is true", async () => {
    render(
      <EntryForm
        prompt="What impact did you make today?"
        onSave={mockOnSave}
        saving={true}
      />
    );
    await userEvent.type(
      screen.getByPlaceholderText("Write about your win..."),
      "anything"
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("renders a refresh-prompt button labeled 'Try another prompt' when onRefreshPrompt is provided", () => {
    render(
      <EntryForm
        prompt="What impact did you make today?"
        onSave={mockOnSave}
        onRefreshPrompt={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Try another prompt" })
    ).toBeInTheDocument();
  });

  it("calls onRefreshPrompt when the refresh button is clicked", async () => {
    const onRefresh = vi.fn();
    render(
      <EntryForm
        prompt="What impact did you make today?"
        onSave={mockOnSave}
        onRefreshPrompt={onRefresh}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Try another prompt" })
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not render a refresh button when onRefreshPrompt is not provided", () => {
    render(
      <EntryForm prompt="What impact did you make today?" onSave={mockOnSave} />
    );
    expect(
      screen.queryByRole("button", { name: "Try another prompt" })
    ).not.toBeInTheDocument();
  });
});
