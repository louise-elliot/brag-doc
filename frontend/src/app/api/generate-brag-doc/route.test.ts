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

describe("POST /api/generate-brag-doc", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mocks.messagesCreate.mockReset();
    mocks.messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            bullets: [
              {
                tag: "leadership",
                points: ["Drove architectural decisions across the team"],
              },
            ],
          }),
        },
      ],
    });
  });

  it("returns grouped bullet points", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.bullets).toHaveLength(1);
    expect(data.bullets[0].tag).toBe("leadership");
    expect(data.bullets[0].points).toContain(
      "Drove architectural decisions across the team"
    );
  });

  it("returns 400 when entries is missing", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request");
  });

  it("defaults to 'tag' grouping when groupBy is absent and includes tag guidance in the system prompt", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [] }),
    });
    await POST(request);
    const call = mocks.messagesCreate.mock.calls[0][0];
    expect(call.system).toContain("Group bullets by tag category");
  });

  it("uses month grouping instructions when groupBy is 'month'", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [], groupBy: "month" }),
    });
    await POST(request);
    const call = mocks.messagesCreate.mock.calls[0][0];
    expect(call.system).toContain("Group bullets by calendar month");
    expect(call.system).toContain("Month YYYY");
  });

  it("uses chronological instructions when groupBy is 'chronological'", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [], groupBy: "chronological" }),
    });
    await POST(request);
    const call = mocks.messagesCreate.mock.calls[0][0];
    expect(call.system).toContain("single group");
    expect(call.system).toContain("empty string");
  });

  it("appends userPrompt guidance to the system prompt when provided", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [],
        userPrompt: "emphasize cross-functional collaboration",
      }),
    });
    await POST(request);
    const call = mocks.messagesCreate.mock.calls[0][0];
    expect(call.system).toContain("emphasize cross-functional collaboration");
    expect(call.system).toContain("additional guidance");
  });

  it("does not append guidance when userPrompt is empty or whitespace-only", async () => {
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [], userPrompt: "   " }),
    });
    await POST(request);
    const call = mocks.messagesCreate.mock.calls[0][0];
    expect(call.system).not.toContain("additional guidance");
  });

  it("returns generic 500 message when the Anthropic SDK throws", async () => {
    mocks.messagesCreate.mockRejectedValueOnce(
      new Error("INTERNAL_KEY_ABC leaked")
    );
    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [] }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBe("Brag doc generation failed");
    expect(JSON.stringify(data)).not.toContain("INTERNAL_KEY_ABC");
  });
});
