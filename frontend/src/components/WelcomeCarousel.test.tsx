// frontend/src/components/WelcomeCarousel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeCarousel } from "./WelcomeCarousel";

function renderCarousel(open: boolean, onClose = vi.fn()) {
  render(<WelcomeCarousel open={open} onClose={onClose} />);
  return { onClose };
}

describe("WelcomeCarousel", () => {
  it("renders nothing when closed", () => {
    renderCarousel(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with the first slide when open", () => {
    renderCarousel(true);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Log a win each day")).toBeInTheDocument();
  });

  it("Next advances to the second slide", async () => {
    renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Let the coach reframe it")).toBeInTheDocument();
  });

  it("Back returns to the previous slide", async () => {
    renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Log a win each day")).toBeInTheDocument();
  });

  it("shows Get started on the last slide", async () => {
    renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Export your brag doc")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Get started" })
    ).toBeInTheDocument();
  });

  it("Skip calls onClose", async () => {
    const { onClose } = renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Get started calls onClose", async () => {
    const { onClose } = renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape calls onClose", () => {
    const { onClose } = renderCarousel(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
