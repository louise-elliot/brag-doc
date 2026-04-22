import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: "text", text: "I resolved a critical production issue" },
          ],
        }),
      };
    },
  };
});

import { POST } from "./route";

describe("POST /api/reframe", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  it("returns reframed text", async () => {
    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "I just helped fix a bug" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reframed).toBe("I resolved a critical production issue");
  });

  it("returns 400 when text is missing", async () => {
    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
