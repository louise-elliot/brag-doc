import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a confidence coach for women in tech. Reframe the following accomplishment to be more direct, impactful, and free of self-diminishing language. Preserve the facts but remove hedging, luck-attribution, and team-deflection. Keep approximately the same length. Return only the reframed text, no commentary.`;

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: body.text }],
    });

    const reframed =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ reframed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
