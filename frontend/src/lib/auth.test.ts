import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.fn();
const getUser = vi.fn();
vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signOut, getUser },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth helpers", () => {
  it("signOut calls Supabase signOut", async () => {
    signOut.mockResolvedValueOnce({ error: null });
    const { signOutCurrentUser } = await import("./auth");
    await signOutCurrentUser();
    expect(signOut).toHaveBeenCalled();
  });

  it("getCurrentUser returns the user or null", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    const { getCurrentUser } = await import("./auth");
    const user = await getCurrentUser();
    expect(user).toEqual({ id: "u1", email: "a@b.com" });
  });
});
