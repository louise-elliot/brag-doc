import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { POST } from "./route";

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  vi.stubEnv("PYTHON_SERVICE_URL", "http://test-python:8000");
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe("POST /api/generate-brag-doc (proxy)", () => {
  it("forwards the request body to the Python /generate-brag-doc endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          bullets: [{ tag: "leadership", points: ["Did the thing"] }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    const requestBody = {
      entries: [
        {
          id: "1",
          date: "2026-04-01",
          prompt: "What impact?",
          original: "Led the review",
          reframed: null,
          tags: ["leadership"],
          createdAt: "2026-04-01T18:00:00Z",
        },
      ],
      groupBy: "month",
      userPrompt: "emphasize collaboration",
    };

    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://test-python:8000/generate-brag-doc");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(requestBody));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bullets[0].tag).toBe("leadership");
  });

  it("passes through non-2xx status codes from Python", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Brag doc generation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Brag doc generation failed" });
  });

  it("returns 502 with generic error body when the Python service is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [] }),
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Brag doc generation failed" });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  it("falls back to localhost:8000 when PYTHON_SERVICE_URL is unset", async () => {
    vi.unstubAllEnvs();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    global.fetch = fetchMock;

    await POST(
      new Request("http://localhost/api/generate-brag-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [] }),
      })
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/generate-brag-doc"
    );
  });
});
