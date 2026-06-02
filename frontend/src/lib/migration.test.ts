import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    rpc,
    auth: { getUser },
    from,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("migration", () => {
  it("does nothing when settings row already exists", async () => {
    single.mockResolvedValueOnce({ data: { user_id: "u1" }, error: null });
    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();
    expect(result).toBe("skipped-returning-user");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("when no settings row and no local data, creates default settings", async () => {
    single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    rpc.mockResolvedValueOnce({ error: null });
    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();
    expect(rpc).toHaveBeenCalledWith("migrate_localstorage", {
      p_entries: [],
      p_settings: { coaching_style: "trusted-mentor", custom_tags: [], user_context: null },
    });
    expect(result).toBe("migrated");
  });

  it("when localStorage has entries + settings, uploads them and clears localStorage", async () => {
    single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    rpc.mockResolvedValueOnce({ error: null });
    localStorage.setItem("byline-entries", JSON.stringify([
      { id: "e1", date: "2026-05-19", prompt: "p", original: "o",
        reframed: null, tags: ["x"], createdAt: "2026-05-19T00:00:00Z", coachNotes: null },
    ]));
    localStorage.setItem("byline-settings", JSON.stringify({
      coachingStyle: "bold-coach",
      contextHeadline: "EM",
      contextNotes: "notes",
    }));
    localStorage.setItem("byline:tags", JSON.stringify([{ name: "x" }, { name: "y" }]));

    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();

    expect(rpc).toHaveBeenCalledWith("migrate_localstorage", {
      p_entries: [
        expect.objectContaining({ id: "e1", date: "2026-05-19", tags: ["x"] }),
      ],
      p_settings: {
        coaching_style: "bold-coach",
        custom_tags: ["x", "y"],
        user_context: { headline: "EM", notes: "notes" },
      },
    });
    expect(localStorage.getItem("byline-entries")).toBeNull();
    expect(localStorage.getItem("byline-settings")).toBeNull();
    expect(localStorage.getItem("byline:tags")).toBeNull();
    expect(result).toBe("migrated");
  });

  it("leaves localStorage intact on RPC error", async () => {
    single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    localStorage.setItem("byline-entries", JSON.stringify([
      { id: "e1", date: "2026-05-19", prompt: "p", original: "o",
        reframed: null, tags: [], createdAt: "2026-05-19T00:00:00Z", coachNotes: null },
    ]));
    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();
    expect(localStorage.getItem("byline-entries")).not.toBeNull();
    expect(result).toBe("error");
  });
});
