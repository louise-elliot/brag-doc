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

const SAMPLE_BODY = {
  entry_text: "I just helped a bit with the migration",
  prompt: "What did you ship?",
  tags: ["technical"],
  conversation: [
    { role: "coach", text: "Who used it?", notes: ["vague-language"] },
    { role: "user", text: "The platform team" },
  ],
};

describe("POST /api/coach/reframe (proxy)", () => {
  it("forwards the request body to the Python /coach/reframe endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          reframed: "I led the migration that unblocked the platform team",
          notes: ["minimising-language"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    const request = new Request("http://localhost/api/coach/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_BODY),
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://test-python:8000/coach/reframe");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(SAMPLE_BODY));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.reframed).toContain("platform team");
  });

  it("passes through non-2xx status codes from Python", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Coach reframe failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = new Request("http://localhost/api/coach/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_BODY),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Coach reframe failed" });
  });

  it("returns 502 with generic error body when the Python service is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const request = new Request("http://localhost/api/coach/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_BODY),
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Coach reframe failed" });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  it("falls back to localhost:8000 when PYTHON_SERVICE_URL is unset", async () => {
    vi.unstubAllEnvs();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    global.fetch = fetchMock;

    await POST(
      new Request("http://localhost/api/coach/reframe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLE_BODY),
      })
    );

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/coach/reframe");
  });
});
