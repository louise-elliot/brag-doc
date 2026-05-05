import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReframeView } from "./ReframeView";

describe("ReframeView", () => {
  const props = {
    original: "I just helped a bit with the project",
    reframed: "I contributed key technical work to the project",
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    props.onAccept.mockClear();
    props.onDismiss.mockClear();
  });

  it("shows the original as text and the reframed text as an editable field", () => {
    render(<ReframeView {...props} />);
    expect(
      screen.getByText("I just helped a bit with the project")
    ).toBeInTheDocument();
    // Reframed text is now in a textarea (findable by display value OR label)
    expect(
      screen.getByDisplayValue("I contributed key technical work to the project")
    ).toBeInTheDocument();
  });

  it("shows 'Your version' and 'Reframed' labels", () => {
    render(<ReframeView {...props} />);
    expect(screen.getByText("Your version")).toBeInTheDocument();
    expect(screen.getByText("Reframed")).toBeInTheDocument();
  });

  it("calls onAccept with the seeded reframed text when Accept is clicked without edits", async () => {
    render(<ReframeView {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(props.onAccept).toHaveBeenCalledWith(
      "I contributed key technical work to the project"
    );
  });

  it("calls onAccept with the user's edited text when Accept is clicked after editing", async () => {
    render(<ReframeView {...props} />);
    const field = screen.getByLabelText(/reframed/i);
    await userEvent.clear(field);
    await userEvent.type(field, "Led the project end-to-end");
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(props.onAccept).toHaveBeenCalledWith("Led the project end-to-end");
  });

  it("calls onDismiss when Dismiss is clicked", async () => {
    render(<ReframeView {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it("renders coach notes as pills in a footer when provided", () => {
    render(
      <ReframeView
        {...props}
        coachNotes={["minimising-language", "vague-language"]}
      />
    );
    expect(screen.getByText("minimising-language")).toBeInTheDocument();
    expect(screen.getByText("vague-language")).toBeInTheDocument();
  });

  it("does not render the coach-notes footer when coachNotes is omitted", () => {
    render(<ReframeView {...props} />);
    expect(screen.queryByText("minimising-language")).not.toBeInTheDocument();
  });
});
