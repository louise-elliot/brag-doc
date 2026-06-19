import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("renders a fallback message", () => {
    render(<GlobalError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
