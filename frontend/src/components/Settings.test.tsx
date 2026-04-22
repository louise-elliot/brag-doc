import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "./Settings";

describe("Settings", () => {
  it("shows clear data button", () => {
    render(<Settings onClearData={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Clear all data" })
    ).toBeInTheDocument();
  });

  it("shows confirmation dialog on click", async () => {
    render(<Settings onClearData={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    expect(
      screen.getByText("This will permanently delete all your journal entries.")
    ).toBeInTheDocument();
  });

  it("calls onClearData when confirmed", async () => {
    const onClearData = vi.fn();
    render(<Settings onClearData={onClearData} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" })
    );
    expect(onClearData).toHaveBeenCalled();
  });

  it("cancels without clearing", async () => {
    const onClearData = vi.fn();
    render(<Settings onClearData={onClearData} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Clear all data" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClearData).not.toHaveBeenCalled();
    expect(
      screen.queryByText("This will permanently delete all your journal entries.")
    ).not.toBeInTheDocument();
  });
});
