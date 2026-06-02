import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Entry } from "./types";

const chain = () => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.from = vi.fn(() => c);
  c.select = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.delete = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.gte = vi.fn(() => c);
  c.lte = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.single = vi.fn(() => c);
  return c;
};

const client = chain();
vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => client,
}));

beforeEach(() => {
  Object.values(client).forEach((fn) => fn.mockClear && fn.mockClear());
});

describe("entries", () => {
  it("getEntries selects from entries ordered by date desc, created_at desc", async () => {
    const row = {
      id: "1", user_id: "u", date: "2026-05-20", prompt: "p", original: "o",
      reframed: null, tags: ["leadership"], coach_notes: null, created_at: "2026-05-20T00:00:00Z",
    };
    client.order.mockReturnValueOnce(client).mockReturnValueOnce(Promise.resolve({ data: [row], error: null }));
    const { getEntries } = await import("./entries");
    const entries = await getEntries();
    expect(client.from).toHaveBeenCalledWith("entries");
    expect(entries[0]).toMatchObject({
      id: "1",
      date: "2026-05-20",
      createdAt: "2026-05-20T00:00:00Z",
      coachNotes: null,
      tags: ["leadership"],
    });
  });

  it("addEntry inserts and returns the row", async () => {
    const inserted = {
      id: "new-id", user_id: "u", date: "2026-05-20", prompt: "p", original: "o",
      reframed: null, tags: [], coach_notes: null, created_at: "2026-05-20T00:00:00Z",
    };
    client.single.mockReturnValueOnce(Promise.resolve({ data: inserted, error: null }));
    // addEntry calls auth.getUser; add that to the mock chain
    (client as Record<string, unknown>).auth = { getUser: vi.fn().mockResolvedValueOnce({ data: { user: { id: "u" } } }) };
    const { addEntry } = await import("./entries");
    const result = await addEntry({
      date: "2026-05-20", prompt: "p", original: "o", reframed: null, tags: [], coachNotes: null,
    } as Omit<Entry, "id" | "createdAt">);
    expect(client.insert).toHaveBeenCalled();
    expect(result.id).toBe("new-id");
  });

  it("deleteEntry deletes by id", async () => {
    client.eq.mockReturnValueOnce(Promise.resolve({ error: null }));
    const { deleteEntry } = await import("./entries");
    await deleteEntry("xyz");
    expect(client.delete).toHaveBeenCalled();
    expect(client.eq).toHaveBeenCalledWith("id", "xyz");
  });

  it("getEntriesByDateRange filters by date range", async () => {
    client.order.mockReturnValueOnce(client).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const { getEntriesByDateRange } = await import("./entries");
    await getEntriesByDateRange("2026-01-01", "2026-05-20");
    expect(client.gte).toHaveBeenCalledWith("date", "2026-01-01");
    expect(client.lte).toHaveBeenCalledWith("date", "2026-05-20");
  });
});
