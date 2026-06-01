import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ marker: "browser-client" })),
}));

describe("supabase browser client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("creates a browser client using env vars", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const { getSupabaseBrowserClient } = await import("./client");
    const client = getSupabaseBrowserClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "anon-key"
    );
    expect(client).toEqual({ marker: "browser-client" });
  });

  it("returns the same client on subsequent calls (singleton)", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const { getSupabaseBrowserClient } = await import("./client");
    getSupabaseBrowserClient();
    getSupabaseBrowserClient();
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
  });
});
