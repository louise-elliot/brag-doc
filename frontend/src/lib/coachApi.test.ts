import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { coachTurn, coachReframe, type CoachMessage } from "./coachApi";

const sampleArgs = {
  entry_text: "Led the rollout",
  prompt: "What did you ship?",
  tags: ["leadership"],
  conversation: [] as CoachMessage[],
};

describe("coachApi", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("coachTurn POSTs to /api/coach/turn and returns parsed JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ text: "Who benefited?", notes: ["vague-language"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await coachTurn(sampleArgs);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/coach/turn",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleArgs),
      })
    );
    expect(result).toEqual({ text: "Who benefited?", notes: ["vague-language"] });
  });

  it("coachTurn throws when the response is not ok", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 })
    );

    await expect(coachTurn(sampleArgs)).rejects.toThrow();
  });

  it("coachReframe POSTs to /api/coach/reframe and returns parsed JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ reframed: "Led the rollout for 40 engineers", notes: ["minimising-language"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await coachReframe(sampleArgs);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/coach/reframe",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleArgs),
      })
    );
    expect(result).toEqual({
      reframed: "Led the rollout for 40 engineers",
      notes: ["minimising-language"],
    });
  });

  it("coachReframe throws when the response is not ok", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 })
    );

    await expect(coachReframe(sampleArgs)).rejects.toThrow();
  });
});
