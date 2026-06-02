import { describe, it, expect, vi, beforeEach } from "vitest";

const chain = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  c.from = vi.fn(() => c);
  c.select = vi.fn(() => c);
  c.upsert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.single = vi.fn(() => c);
  c.auth = { getUser: vi.fn() };
  return c;
};

const client = chain();
vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => client,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settings", () => {
  it("readSettings returns mapped fields from the settings row", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: {
        user_id: "u1",
        coaching_style: "hype-woman",
        custom_tags: [],
        user_context: { headline: "Eng manager", notes: "team of 6" },
      },
      error: null,
    }));
    const { readSettings } = await import("./settings");
    const result = await readSettings();
    expect(result).toEqual({
      coachingStyle: "hype-woman",
      contextHeadline: "Eng manager",
      contextNotes: "team of 6",
    });
  });

  it("readSettings returns defaults when no row exists", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: null,
      error: { code: "PGRST116" }, // 'no rows' from PostgREST
    }));
    const { readSettings } = await import("./settings");
    const result = await readSettings();
    expect(result).toEqual({
      coachingStyle: "trusted-mentor",
      contextHeadline: "",
      contextNotes: "",
    });
  });

  it("writeSettings upserts the row for the current user", async () => {
    // writeSettings reads first, then upserts. Mock the read to return defaults via PGRST116.
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: null,
      error: { code: "PGRST116" },
    }));
    client.upsert.mockReturnValueOnce(Promise.resolve({ error: null }));
    const { writeSettings } = await import("./settings");
    await writeSettings({ coachingStyle: "bold-coach" });
    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        coaching_style: "bold-coach",
      }),
      expect.objectContaining({ onConflict: "user_id" })
    );
  });
});
