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
  conversation: [],
};

describe("POST /api/coach/turn (proxy)", () => {
  it("forwards the request body to the Python /coach/turn endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: "Who specifically benefited?", notes: ["vague-language"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    const request = new Request("http://localhost/api/coach/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_BODY),
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://test-python:8000/coach/turn");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(SAMPLE_BODY));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.text).toBe("Who specifically benefited?");
  });

  it("passes through non-2xx status codes from Python", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Coach turn failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = new Request("http://localhost/api/coach/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_BODY),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Coach turn failed" });
  });

  it("returns 502 with generic error body when the Python service is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const request = new Request("http://localhost/api/coach/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_BODY),
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Coach turn failed" });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  it("falls back to localhost:8000 when PYTHON_SERVICE_URL is unset", async () => {
    vi.unstubAllEnvs();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    global.fetch = fetchMock;

    await POST(
      new Request("http://localhost/api/coach/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLE_BODY),
      })
    );

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/coach/turn");
  });
});
