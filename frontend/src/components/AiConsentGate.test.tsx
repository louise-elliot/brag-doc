import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiConsentGate } from "./AiConsentGate";

describe("AiConsentGate", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <AiConsentGate open={false} onAccept={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Anthropic disclosure when open", () => {
    render(<AiConsentGate open={true} onAccept={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/sent to Anthropic/i)).toBeInTheDocument();
  });

  it("calls onAccept when continue is clicked", () => {
    const onAccept = vi.fn();
    render(<AiConsentGate open={true} onAccept={onAccept} onCancel={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /i understand, continue/i })
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<AiConsentGate open={true} onAccept={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
