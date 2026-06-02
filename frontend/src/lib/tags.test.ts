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

describe("tags", () => {
  it("getTags returns defaults when settings row has empty custom_tags", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: { custom_tags: [] }, error: null,
    }));
    const { getTags } = await import("./tags");
    const result = await getTags();
    expect(result.map((t) => t.name)).toEqual([
      "leadership", "technical", "collaboration",
      "problem-solving", "communication", "mentoring",
    ]);
  });

  it("getTags returns custom_tags when set", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: { custom_tags: ["alpha", "beta"] }, error: null,
    }));
    const { getTags } = await import("./tags");
    const result = await getTags();
    expect(result.map((t) => t.name)).toEqual(["alpha", "beta"]);
  });

  it("saveTags upserts the names into custom_tags", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.upsert.mockReturnValueOnce(Promise.resolve({ error: null }));
    const { saveTags } = await import("./tags");
    await saveTags([{ name: "x" }, { name: "y" }]);
    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", custom_tags: ["x", "y"] }),
      expect.objectContaining({ onConflict: "user_id" })
    );
  });
});
