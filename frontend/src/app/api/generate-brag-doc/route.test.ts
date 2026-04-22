import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
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
        }),
      };
    },
  };
});

import { POST } from "./route";

describe("POST /api/generate-brag-doc", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
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
});
