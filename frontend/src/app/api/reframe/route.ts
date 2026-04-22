import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a confidence coach for women in tech. Reframe the following accomplishment to be more direct, impactful, and free of self-diminishing language. Preserve the facts but remove hedging, luck-attribution, and team-deflection. Keep approximately the same length. Return only the reframed text, no commentary.`;

const anthropic = new Anthropic();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const text =
    body && typeof body === "object" && "text" in body
      ? (body as { text: unknown }).text
      : undefined;

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const reframed =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ reframed });
  } catch (error) {
    console.error("reframe route failed", error);
    return NextResponse.json({ error: "Reframe failed" }, { status: 500 });
  }
}
