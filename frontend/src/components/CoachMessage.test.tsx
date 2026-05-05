import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachMessage } from "./CoachMessage";

describe("CoachMessage", () => {
  it("renders coach text in a coach bubble with role label", () => {
    render(<CoachMessage role="coach" text="Who benefited?" />);
    expect(screen.getByText("Who benefited?")).toBeInTheDocument();
    expect(screen.getByText(/coach/i)).toBeInTheDocument();
  });

  it("renders coach notes as pills when provided", () => {
    render(
      <CoachMessage
        role="coach"
        text="Who benefited?"
        notes={["hedging", "missing-audience"]}
      />
    );
    expect(screen.getByText("hedging")).toBeInTheDocument();
    expect(screen.getByText("missing-audience")).toBeInTheDocument();
  });

  it("does not render notes for user messages", () => {
    render(<CoachMessage role="user" text="The platform team" notes={["hedging"]} />);
    expect(screen.queryByText("hedging")).not.toBeInTheDocument();
  });

  it("renders user text in a user bubble with role label", () => {
    render(<CoachMessage role="user" text="The platform team" />);
    expect(screen.getByText("The platform team")).toBeInTheDocument();
    expect(screen.getByText(/you/i)).toBeInTheDocument();
  });
});
