import { describe, it, expect, vi } from "vitest";
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

  it("shows original and reframed side by side", () => {
    render(<ReframeView {...props} />);
    expect(
      screen.getByText("I just helped a bit with the project")
    ).toBeInTheDocument();
    expect(
      screen.getByText("I contributed key technical work to the project")
    ).toBeInTheDocument();
  });

  it("shows 'Your version' and 'Reframed' labels", () => {
    render(<ReframeView {...props} />);
    expect(screen.getByText("Your version")).toBeInTheDocument();
    expect(screen.getByText("Reframed")).toBeInTheDocument();
  });

  it("calls onAccept when accept is clicked", async () => {
    render(<ReframeView {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(props.onAccept).toHaveBeenCalled();
  });

  it("calls onDismiss when dismiss is clicked", async () => {
    render(<ReframeView {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(props.onDismiss).toHaveBeenCalled();
  });
});
