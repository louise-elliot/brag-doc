import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mocks.messagesCreate };
    },
  };
});

import { POST } from "./route";

describe("POST /api/reframe", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mocks.messagesCreate.mockReset();
    mocks.messagesCreate.mockResolvedValue({
      content: [
        { type: "text", text: "I resolved a critical production issue" },
      ],
    });
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

  it("returns 400 on invalid JSON body", async () => {
    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request");
  });

  it("returns generic 500 message when the Anthropic SDK throws", async () => {
    mocks.messagesCreate.mockRejectedValueOnce(
      new Error("UPSTREAM_SECRET_KEY_XYZ leaked")
    );
    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBe("Reframe failed");
    expect(JSON.stringify(data)).not.toContain("UPSTREAM_SECRET_KEY_XYZ");
  });
});
