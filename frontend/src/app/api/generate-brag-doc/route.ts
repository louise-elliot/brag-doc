import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Entry } from "@/lib/types";

type GroupBy = "tag" | "month" | "chronological";

const BASE_PROMPT = `You are a performance review coach for women in tech. Given a list of journal entries about professional accomplishments, synthesize them into concise, impact-focused bullet points. Each bullet should be written in strong, confident language suitable for pasting into a performance self-review.

Return JSON in this exact format:
{"bullets": [{"tag": "group label", "points": ["bullet point 1", "bullet point 2"]}]}

Return only the JSON, no other text.`;

const GROUP_BY_CLAUSE: Record<GroupBy, string> = {
  tag:
    "Group bullets by tag category. Each group's `tag` field is the tag name.",
  month:
    "Group bullets by calendar month based on each entry's date. Each group's `tag` field is the month label in the form 'Month YYYY' (e.g. 'April 2026'). Order groups newest-first.",
  chronological:
    "Return a single group with the `tag` field set to an empty string. Include bullets ordered newest-first across all entries.",
};

const anthropic = new Anthropic();

function buildSystemPrompt(groupBy: GroupBy, userPrompt?: string): string {
  const trimmed = userPrompt?.trim();
  const guidance = trimmed
    ? `\n\nThe user has added this additional guidance: ${trimmed}\n\nHonor it while keeping your core role as a performance review coach.`
    : "";
  return `${BASE_PROMPT}\n\n${GROUP_BY_CLAUSE[groupBy]}${guidance}`;
}

function parseGroupBy(value: unknown): GroupBy {
  if (value === "month" || value === "chronological") return value;
  return "tag";
}

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

  const groupBy = parseGroupBy(
    (body as { groupBy?: unknown }).groupBy
  );
  const userPrompt = (body as { userPrompt?: unknown }).userPrompt;
  const userPromptStr =
    typeof userPrompt === "string" ? userPrompt : undefined;

  const entries: Entry[] = rawEntries as Entry[];
  const summary = entries
    .map((e) => `[${e.date}] [${e.tags.join(", ")}] ${e.original}`)
    .join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: buildSystemPrompt(groupBy, userPromptStr),
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
