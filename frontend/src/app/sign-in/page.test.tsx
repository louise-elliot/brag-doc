import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SignInPage from "./page";

const signInWithOtp = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithOtp },
  }),
}));

describe("SignInPage", () => {
  it("sends a magic link to the entered email and shows confirmation", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "user@example.com",
        options: { emailRedirectTo: expect.stringContaining("/auth/callback") },
      });
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("shows an error message when sign-in fails", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: "rate limited" } });
    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText(/rate limited/i)).toBeInTheDocument();
  });
});
