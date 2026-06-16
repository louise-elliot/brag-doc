import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const ORIGINAL_FETCH = global.fetch;

function mockSession(accessToken: string | null) {
  vi.mocked(getSupabaseServerClient).mockResolvedValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: accessToken ? { access_token: accessToken } : null },
      }),
    },
  } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);
}

beforeEach(() => {
  vi.stubEnv("PYTHON_SERVICE_URL", "http://test-python:8000");
  mockSession("test-token");
});
afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/admin/cost (proxy)", () => {
  it("forwards to the backend with the bearer token and the days param", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ budget_usd: 5 }), { status: 200 })
    );
    global.fetch = fetchMock;

    const res = await GET(new Request("http://app/api/admin/cost?days=7"));

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://test-python:8000/admin/cost/summary?days=7");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("passes a backend 403 through unchanged", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const res = await GET(new Request("http://app/api/admin/cost"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when there is no session", async () => {
    mockSession(null);
    const res = await GET(new Request("http://app/api/admin/cost"));
    expect(res.status).toBe(401);
  });
});
