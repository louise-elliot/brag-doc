import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Entry } from "@/lib/types";

const SYSTEM_PROMPT = `You are a performance review coach for women in tech. Given a list of journal entries about professional accomplishments, synthesize them into concise, impact-focused bullet points grouped by category. Each bullet should be written in strong, confident language suitable for pasting into a performance self-review.

Return JSON in this exact format:
{"bullets": [{"tag": "category name", "points": ["bullet point 1", "bullet point 2"]}]}

Return only the JSON, no other text.`;

const anthropic = new Anthropic();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rawEntries =
    body && typeof body === "object" && "entries" in body
      ? (body as { entries: unknown }).entries
      : undefined;

  if (!Array.isArray(rawEntries)) {
    return NextResponse.json(
      { error: "entries array is required" },
      { status: 400 }
    );
  }

  const entries: Entry[] = rawEntries as Entry[];
  const summary = entries
    .map((e) => `[${e.tags.join(", ")}] ${e.original}`)
    .join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: summary }],
    });

    let text =
      message.content[0].type === "text" ? message.content[0].text : "{}";
    text = text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("generate-brag-doc route failed", error);
    return NextResponse.json(
      { error: "Brag doc generation failed" },
      { status: 500 }
    );
  }
}
