import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachNotePills } from "./CoachNotePills";

describe("CoachNotePills", () => {
  it("renders a pill for each note", () => {
    render(<CoachNotePills notes={["minimising-language", "missing-metrics"]} />);
    expect(screen.getByText("minimising-language")).toBeInTheDocument();
    expect(screen.getByText("missing-metrics")).toBeInTheDocument();
  });

  it("renders nothing when notes is null", () => {
    const { container } = render(<CoachNotePills notes={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when notes is an empty array", () => {
    const { container } = render(<CoachNotePills notes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
