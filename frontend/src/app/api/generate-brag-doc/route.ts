import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Entry } from "@/lib/types";

const SYSTEM_PROMPT = `You are a performance review coach for women in tech. Given a list of journal entries about professional accomplishments, synthesize them into concise, impact-focused bullet points grouped by category. Each bullet should be written in strong, confident language suitable for pasting into a performance self-review.

Return JSON in this exact format:
{"bullets": [{"tag": "category name", "points": ["bullet point 1", "bullet point 2"]}]}

Return only the JSON, no other text.`;

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.entries || !Array.isArray(body.entries)) {
    return NextResponse.json(
      { error: "entries array is required" },
      { status: 400 }
    );
  }

  const entries: Entry[] = body.entries;
  const summary = entries
    .map((e) => `[${e.tags.join(", ")}] ${e.original}`)
    .join("\n");

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: summary }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "{}";
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
