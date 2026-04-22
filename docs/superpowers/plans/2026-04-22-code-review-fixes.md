# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the consolidated fixes from the two MVP code reviews (`mvp-review-claude.md`, `mvp-review-cursor.md`) — timezone bug, robustness gaps, accessibility, three spec gaps (800 ms save ceremony, Settings pill, editable reframed text), Settings privacy copy, and test/docs hygiene.

**Architecture:** No architectural change. The app stays a single-page Next.js (App Router) client-rendered UI with two API routes and localStorage persistence. Changes are localised to individual files; one new shared module (`src/lib/tags.ts`) replaces two duplicate in-file records.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind 4, Vitest + React Testing Library, Playwright, `@anthropic-ai/sdk`.

**Scope decisions (locked in with user):**
- Implement: 800 ms save ceremony, Settings pill in header, editable reframed text.
- Drop by updating spec: strikethrough of self-diminishing words.
- Defer: inline-styles → Tailwind migration, prompt-injection hardening, startup env validation, bullet key stability, JSON-schema tool use.

**Git note:** The user handles all git commits manually. Each task ends with a "Stop for commit" checkpoint — do NOT run `git commit` in this plan. Stage nothing automatically.

**Working directory for all file paths:** `/Users/louiseelliot/LLMProjects/confidence-app`. Relative paths below are from the repo root.

---

## File Structure

Files created:
- `frontend/src/lib/tags.ts` — single source of truth for tag colors (Task 8)
- `frontend/src/lib/dates.ts` — `todayLocal()` helper (Task 5)
- `frontend/.env.example` — documents required env var (Task 4)

Files modified (by task):
- `CLAUDE.md` — typo (Task 1)
- `frontend/src/components/EntryList.tsx` — drop unused `colors` var; consume `lib/tags.ts` (Tasks 1, 8)
- `frontend/src/lib/entries.test.ts` — drop unused `STORAGE_KEY` (Task 1)
- `frontend/src/app/globals.css` — drop unused `.animate-delay-3` and `.animate-delay-5` (Task 2)
- `frontend/README.md` — replace boilerplate (Task 3)
- `frontend/src/components/App.tsx` — local date, pill, `aria-live`, tablist wiring, 800 ms ceremony plumbing (Tasks 5, 13, 14, 16, 17)
- `frontend/src/components/BragDoc.tsx` — local date, try/catch/finally, clipboard rejection, select label (Tasks 5, 11, 12, 15)
- `frontend/src/lib/entries.ts` — safe parse, stable sort (Tasks 6, 7)
- `frontend/src/lib/entries.test.ts` — new tests for safe parse + same-day sort (Tasks 6, 7)
- `frontend/src/components/TagPicker.tsx` — consume `lib/tags.ts` (Task 8)
- `frontend/src/app/api/reframe/route.ts` — module-scope client, guarded parse, generic error (Task 9)
- `frontend/src/app/api/generate-brag-doc/route.ts` — same as above (Task 9)
- `frontend/src/components/EntryForm.tsx` — disable Save while `saving`, 800 ms textarea clear (Tasks 10, 16)
- `frontend/src/components/ReframeView.tsx` — editable reframed text; `onAccept` takes final text (Task 18)
- `frontend/src/components/Settings.tsx` — privacy copy rewrite (Task 19)
- `frontend/src/components/App.test.tsx` — new accept-flow test (Task 21)
- `frontend/e2e/journal.spec.ts` — stub `/api/reframe` (Task 22)
- `frontend/e2e/brag-doc.spec.ts` — stub `/api/generate-brag-doc` (Task 22)
- `docs/superpowers/specs/ui-design.md` — drop strikethrough line from ReframeView spec (Task 20)

---

## Task 1: Fix lint warnings and CLAUDE.md typo

**Files:**
- Modify: `CLAUDE.md:9`
- Modify: `frontend/src/components/EntryList.tsx:44`
- Modify: `frontend/src/lib/entries.test.ts:11`

- [ ] **Step 1: Fix CLAUDE.md typo `team.v` → `team.`**

In `CLAUDE.md:9` the last line of the "Target User" paragraph ends with `team.v`. Change it to `team.`

- [ ] **Step 2: Remove unused `colors` variable in `EntryList.tsx:44`**

Delete the line:

```ts
const colors = entry.tags.length > 0 ? TAG_COLORS[entry.tags[0]] : null;
```

It is not referenced anywhere in the `.map` body. The per-tag color lookup on line 105 (`const tagColors = TAG_COLORS[tag];`) stays.

- [ ] **Step 3: Remove unused `STORAGE_KEY` in `frontend/src/lib/entries.test.ts`**

Delete `const STORAGE_KEY = "confidence-journal-entries";` near the top. Tests use `localStorage.clear()` — the constant is dead.

- [ ] **Step 4: Verify lint passes**

Run: `cd frontend && npm run lint`
Expected: `✔ No ESLint warnings or errors` (previously 2 warnings).

- [ ] **Step 5: Verify type-check passes**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 6: Stop for commit**

Suggested message: `fix: clear lint warnings and CLAUDE.md typo`

---

## Task 2: Remove unused animate-delay CSS classes

**Files:**
- Modify: `frontend/src/app/globals.css:166-168`

- [ ] **Step 1: Check which delays are actually used**

Run: `grep -rn "animate-delay-" frontend/src`
Expected: matches only `animate-delay-1`, `animate-delay-2`, `animate-delay-4`.

- [ ] **Step 2: Delete `.animate-delay-3` and `.animate-delay-5`**

In `frontend/src/app/globals.css`, remove these two lines:

```css
.animate-delay-3 { animation-delay: 0.18s; }
.animate-delay-5 { animation-delay: 0.30s; }
```

Keep `.animate-delay-1`, `.animate-delay-2`, and `.animate-delay-4`.

- [ ] **Step 3: Verify build still works**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Stop for commit**

Suggested message: `chore: drop unused animate-delay CSS classes`

---

## Task 3: Replace frontend README with a minimal one

**Files:**
- Modify: `frontend/README.md` (full rewrite)

- [ ] **Step 1: Overwrite `frontend/README.md` with this content**

```markdown
# Confidence Journal

Daily wins journal for women in tech. Write entries, reframe self-critical language with Claude, generate a brag doc for performance reviews. Data lives in `localStorage`; AI calls are proxied through two Next.js API routes.

## Setup

Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`.

```
npm install
```

## Scripts

- `npm run dev` — start dev server on :3000
- `npm run build` — production build
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright end-to-end tests
- `npm run lint` — ESLint
```

Note: the inner fence above must be rendered verbatim as a code block inside the README. When writing the file, use four-backtick fences on the outer block to keep the inner three-backtick block intact.

- [ ] **Step 2: Verify the file renders correctly**

Run: `cat frontend/README.md | head -20`
Expected: clean markdown, no "create-next-app" or "Geist" references.

- [ ] **Step 3: Stop for commit**

Suggested message: `docs: replace boilerplate README`

---

## Task 4: Add `.env.example`

**Files:**
- Create: `frontend/.env.example`

- [ ] **Step 1: Create the file with the single required var**

File contents (one line):

```
ANTHROPIC_API_KEY=
```

- [ ] **Step 2: Verify `.env.local` still works and is gitignored**

Run: `grep -n ".env" frontend/.gitignore`
Expected: at least `.env*` or `.env.local` line present.

- [ ] **Step 3: Stop for commit**

Suggested message: `docs: document ANTHROPIC_API_KEY env var`

---

## Task 5: Add `todayLocal()` helper and use it everywhere

**Files:**
- Create: `frontend/src/lib/dates.ts`
- Create: `frontend/src/lib/dates.test.ts`
- Modify: `frontend/src/components/App.tsx:32`
- Modify: `frontend/src/components/BragDoc.tsx:17-24`

Context: `toISOString().split("T")[0]` returns UTC. A user in UTC+10 writing at 8 AM local time gets an entry dated to the previous day, and the "last 30 days" cutoff slips a day too. Fix by computing the local calendar date.

- [ ] **Step 1: Write failing test for `todayLocal()` and `localDateFromOffset()`**

Create `frontend/src/lib/dates.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { todayLocal, localDateFromOffset } from "./dates";

describe("todayLocal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD in local time, not UTC", () => {
    // 2026-04-22 at 23:30 local — toISOString() would roll over to 2026-04-23 in UTC-heavy zones
    vi.setSystemTime(new Date(2026, 3, 22, 23, 30, 0));
    expect(todayLocal()).toBe("2026-04-22");
  });

  it("pads month and day", () => {
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
    expect(todayLocal()).toBe("2026-01-05");
  });
});

describe("localDateFromOffset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 22, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("subtracts days in local time", () => {
    expect(localDateFromOffset(30)).toBe("2026-03-23");
  });

  it("returns today for offset 0", () => {
    expect(localDateFromOffset(0)).toBe("2026-04-22");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `Cannot find module './dates'`.

- [ ] **Step 3: Implement `frontend/src/lib/dates.ts`**

```ts
function formatLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return formatLocal(new Date());
}

export function localDateFromOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatLocal(d);
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd frontend && npx vitest run src/lib/dates.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Use `todayLocal()` in `App.tsx`**

In `frontend/src/components/App.tsx`, replace line 32:

```ts
const today = new Date().toISOString().split("T")[0];
```

with:

```ts
const today = todayLocal();
```

Add the import at the top alongside the other `@/lib` imports:

```ts
import { todayLocal } from "@/lib/dates";
```

- [ ] **Step 6: Use `localDateFromOffset()` in `BragDoc.tsx`**

In `frontend/src/components/BragDoc.tsx`, replace lines 17–24 (the `filterByRange` function) with:

```ts
function filterByRange(entries: Entry[], range: DateRange): Entry[] {
  if (range === "all") return entries;
  const days = parseInt(range);
  const cutoffStr = localDateFromOffset(days);
  return entries.filter((e) => e.date >= cutoffStr);
}
```

Add the import at the top:

```ts
import { localDateFromOffset } from "@/lib/dates";
```

- [ ] **Step 7: Run full test suite to confirm nothing regressed**

Run: `cd frontend && npm test -- --run`
Expected: all tests pass.

- [ ] **Step 8: Stop for commit**

Suggested message: `fix: use local calendar date, not UTC, for today and range cutoffs`

---

## Task 6: Guard localStorage read against corrupt payloads

**Files:**
- Modify: `frontend/src/lib/entries.ts:5-8`
- Modify: `frontend/src/lib/entries.test.ts` (add test)

- [ ] **Step 1: Write failing test**

Add this test to `frontend/src/lib/entries.test.ts` (place inside the existing `describe("entries", …)` or create a new block at the bottom):

```ts
import { getEntries } from "./entries";

describe("getEntries with corrupt storage", () => {
  it("returns empty array when localStorage value is not valid JSON", () => {
    localStorage.setItem("confidence-journal-entries", "{not json");
    expect(getEntries()).toEqual([]);
  });

  it("returns empty array when localStorage value is JSON but not an array", () => {
    localStorage.setItem("confidence-journal-entries", JSON.stringify({ foo: "bar" }));
    expect(getEntries()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts -t "corrupt"`
Expected: FAIL — `JSON.parse` throws or `.sort is not a function`.

- [ ] **Step 3: Implement the guard**

In `frontend/src/lib/entries.ts`, replace the `readEntries` function (lines 5–8) with:

```ts
function readEntries(): Entry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts -t "corrupt"`
Expected: 2 tests pass.

- [ ] **Step 5: Stop for commit**

Suggested message: `fix: survive corrupt localStorage payload`

---

## Task 7: Stable sort for same-day entries (tiebreak on `createdAt`)

**Files:**
- Modify: `frontend/src/lib/entries.ts:14-18`
- Modify: `frontend/src/lib/entries.test.ts` (add test)

- [ ] **Step 1: Write failing test**

Add to `frontend/src/lib/entries.test.ts`:

```ts
describe("getEntries same-day ordering", () => {
  it("sorts same-day entries newest-first by createdAt", () => {
    const earlier = {
      id: "a",
      date: "2026-04-22",
      prompt: "",
      original: "earlier",
      reframed: null,
      tags: [],
      createdAt: "2026-04-22T09:00:00.000Z",
    };
    const later = {
      id: "b",
      date: "2026-04-22",
      prompt: "",
      original: "later",
      reframed: null,
      tags: [],
      createdAt: "2026-04-22T17:00:00.000Z",
    };
    // Insert earlier first so default insertion order would yield [earlier, later]
    localStorage.setItem(
      "confidence-journal-entries",
      JSON.stringify([earlier, later])
    );
    const result = getEntries();
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("a");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts -t "same-day"`
Expected: FAIL — current sort treats same-day as equal, preserving insertion order so `result[0].id === "a"`.

- [ ] **Step 3: Update `getEntries` sort**

In `frontend/src/lib/entries.ts`, replace the `getEntries` function (lines 14–18) with:

```ts
export function getEntries(): Entry[] {
  return readEntries().sort((a, b) => {
    const byDate =
      new Date(b.date).getTime() - new Date(a.date).getTime();
    if (byDate !== 0) return byDate;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts`
Expected: all entries tests pass, including the new one.

- [ ] **Step 5: Stop for commit**

Suggested message: `fix: tiebreak same-day entries on createdAt`

---

## Task 8: Extract `TAG_COLORS` into shared module

**Files:**
- Create: `frontend/src/lib/tags.ts`
- Modify: `frontend/src/components/TagPicker.tsx:5-12`
- Modify: `frontend/src/components/EntryList.tsx:6-13`

Goal: the same `TAG_COLORS` record lives in both components. Move to `lib/tags.ts`.

- [ ] **Step 1: Create `frontend/src/lib/tags.ts`**

```ts
export interface TagColor {
  color: string;
  bg: string;
  border: string;
}

export const TAG_COLORS: Record<string, TagColor> = {
  leadership: {
    color: "#D4863C",
    bg: "rgba(212,134,60,0.12)",
    border: "rgba(212,134,60,0.3)",
  },
  technical: {
    color: "#6B8AE0",
    bg: "rgba(107,138,224,0.12)",
    border: "rgba(107,138,224,0.3)",
  },
  collaboration: {
    color: "#4CAF82",
    bg: "rgba(76,175,130,0.12)",
    border: "rgba(76,175,130,0.3)",
  },
  "problem-solving": {
    color: "#C978D6",
    bg: "rgba(201,120,214,0.12)",
    border: "rgba(201,120,214,0.3)",
  },
  communication: {
    color: "#E0C46B",
    bg: "rgba(224,196,107,0.12)",
    border: "rgba(224,196,107,0.3)",
  },
  mentoring: {
    color: "#E07272",
    bg: "rgba(224,114,114,0.12)",
    border: "rgba(224,114,114,0.3)",
  },
};
```

- [ ] **Step 2: Remove inline `TAG_COLORS` from `TagPicker.tsx`, import from `lib/tags`**

In `frontend/src/components/TagPicker.tsx`:
- Delete lines 5–12 (the `const TAG_COLORS: Record<…> = { … };` block).
- Add to imports at top:

```ts
import { TAG_COLORS } from "@/lib/tags";
```

- [ ] **Step 3: Remove inline `TAG_COLORS` from `EntryList.tsx`, import from `lib/tags`**

In `frontend/src/components/EntryList.tsx`:
- Delete lines 6–13.
- Add to imports at top:

```ts
import { TAG_COLORS } from "@/lib/tags";
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test -- --run`
Expected: all tests pass.

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Stop for commit**

Suggested message: `refactor: single source of truth for TAG_COLORS`

---

## Task 9: Harden API routes (module-scope client, guarded parse, generic errors)

**Files:**
- Modify: `frontend/src/app/api/reframe/route.ts`
- Modify: `frontend/src/app/api/generate-brag-doc/route.ts`

Three problems rolled into one task because the routes are tiny and symmetric:
1. `new Anthropic()` is constructed per request — lift to module scope.
2. `await request.json()` is outside `try/catch` — invalid JSON produces a Next-default 500 with internal details.
3. The catch block returns `error.message` to the client, leaking SDK internals.

- [ ] **Step 1: Write/update route tests for the new behavior**

Inspect existing test files:

Run: `ls frontend/src/app/api/reframe frontend/src/app/api/generate-brag-doc`
Expected: each has a `route.test.ts`.

Read each test file to see the current mocking style, then **add** these two tests to `frontend/src/app/api/reframe/route.test.ts` (adapting mock setup to match the existing style in that file):

```ts
it("returns 400 on invalid JSON body", async () => {
  const request = new Request("http://test/api/reframe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
  const response = await POST(request);
  expect(response.status).toBe(400);
  const json = await response.json();
  expect(json.error).toBe("Invalid request");
});

it("returns generic 500 message when the Anthropic SDK throws", async () => {
  // This test assumes the existing mock setup for @anthropic-ai/sdk is in place.
  // Override the mock to throw:
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Anthropic as any).prototype.messages = {
    create: vi.fn().mockRejectedValue(new Error("UPSTREAM_SECRET_KEY_XYZ leaked")),
  };
  const request = new Request("http://test/api/reframe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hello" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(500);
  const json = await response.json();
  expect(json.error).toBe("Reframe failed");
  expect(JSON.stringify(json)).not.toContain("UPSTREAM_SECRET_KEY_XYZ");
});
```

Add an equivalent pair to `frontend/src/app/api/generate-brag-doc/route.test.ts`, substituting `Reframe failed` → `Brag doc generation failed` and the body to `{ entries: [] }`.

- [ ] **Step 2: Run the new tests, verify they fail**

Run: `cd frontend && npx vitest run src/app/api`
Expected: the four new tests fail. Old tests still pass.

- [ ] **Step 3: Rewrite `frontend/src/app/api/reframe/route.ts`**

Full replacement:

```ts
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
```

- [ ] **Step 4: Rewrite `frontend/src/app/api/generate-brag-doc/route.ts`**

Full replacement:

```ts
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
```

- [ ] **Step 5: Run all API route tests**

Run: `cd frontend && npx vitest run src/app/api`
Expected: all tests pass, including the four new ones.

- [ ] **Step 6: Stop for commit**

Suggested message: `refactor(api): lift Anthropic client, guard JSON parse, generic error messages`

---

## Task 10: Disable Save button while reframe is in flight

**Files:**
- Modify: `frontend/src/components/EntryForm.tsx`
- Modify: `frontend/src/components/App.tsx`
- Modify: `frontend/src/components/EntryForm.test.tsx` (add test)

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/EntryForm.test.tsx`:

```tsx
it("disables the Save button when saving=true", () => {
  render(
    <EntryForm prompt="anything?" onSave={() => {}} saving={true} />
  );
  const input = screen.getByPlaceholderText(/write about your win/i);
  fireEvent.change(input, { target: { value: "some text" } });
  expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
});
```

(If the existing test file doesn't already import `fireEvent`/`screen`, add those imports from `@testing-library/react`.)

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/components/EntryForm.test.tsx -t "saving"`
Expected: FAIL — `EntryForm` doesn't accept a `saving` prop.

- [ ] **Step 3: Update `EntryForm` to accept and honor `saving`**

In `frontend/src/components/EntryForm.tsx`, update the props interface and the submit button:

Change the interface (around lines 6–9):

```ts
interface EntryFormProps {
  prompt: string;
  onSave: (data: { original: string; tags: string[] }) => void;
  saving?: boolean;
}
```

Change the destructuring on line 11:

```ts
export function EntryForm({ prompt, onSave, saving = false }: EntryFormProps) {
```

On the submit button (around line 97), change:

```tsx
disabled={!text.trim()}
```

to:

```tsx
disabled={!text.trim() || saving}
```

And in the inline style block for that button, update `cursor` and `opacity` to consider `saving`:

```tsx
cursor: text.trim() && !saving ? "pointer" : "not-allowed",
opacity: text.trim() && !saving ? 1 : 0.4,
```

- [ ] **Step 4: Pass `saving` from `App` to `EntryForm`**

In `frontend/src/components/App.tsx`, update the JSX on line 191 from:

```tsx
<EntryForm prompt={prompt} onSave={handleSave} />
```

to:

```tsx
<EntryForm prompt={prompt} onSave={handleSave} saving={reframeLoading} />
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `cd frontend && npx vitest run src/components/EntryForm.test.tsx`
Expected: all EntryForm tests pass.

- [ ] **Step 6: Stop for commit**

Suggested message: `fix: disable Save while reframe request is in flight`

---

## Task 11: Wrap `BragDoc.generate()` in try/catch/finally

**Files:**
- Modify: `frontend/src/components/BragDoc.tsx:48-69`
- Modify: `frontend/src/components/BragDoc.test.tsx` (add test)

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/BragDoc.test.tsx`:

```tsx
it("clears loading state and shows an error when fetch throws", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

  render(<BragDoc entries={[sampleEntry()]} />);
  fireEvent.click(screen.getByRole("button", { name: /generate/i }));

  await waitFor(() => {
    expect(screen.getByText(/failed to generate brag doc/i)).toBeInTheDocument();
  });

  // Button should say "Generate" again (not stuck on "Generating...")
  expect(screen.getByRole("button", { name: /^generate$/i })).toBeEnabled();

  globalThis.fetch = originalFetch;
});
```

(`sampleEntry()` should match the existing test's factory; reuse whatever the file already defines or inline a minimal Entry literal.)

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/components/BragDoc.test.tsx -t "fetch throws"`
Expected: FAIL — the unhandled rejection leaves `loading=true` and the test times out waiting for the error.

- [ ] **Step 3: Rewrite `generate()` with try/catch/finally**

In `frontend/src/components/BragDoc.tsx`, replace the `generate` function (lines 48–69) with:

```ts
async function generate() {
  setLoading(true);
  setError(null);
  setBullets(null);

  try {
    const filtered = filterByRange(entries, range);
    const response = await fetch("/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: filtered }),
    });

    if (!response.ok) {
      setError("Failed to generate brag doc. Please try again.");
      return;
    }

    const data = await response.json();
    setBullets(data.bullets);
  } catch {
    setError("Failed to generate brag doc. Please try again.");
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd frontend && npx vitest run src/components/BragDoc.test.tsx`
Expected: all BragDoc tests pass.

- [ ] **Step 5: Stop for commit**

Suggested message: `fix: clear BragDoc loading state on thrown fetch errors`

---

## Task 12: Handle clipboard write rejection

**Files:**
- Modify: `frontend/src/components/BragDoc.tsx:71-82`
- Modify: `frontend/src/components/BragDoc.test.tsx` (add test)

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/BragDoc.test.tsx`:

```tsx
it("shows an error if clipboard write rejects", async () => {
  // Seed a successful generate, then override clipboard
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      bullets: [{ tag: "leadership", points: ["Led X"] }],
    }),
  });
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockRejectedValue(new Error("blocked")),
    },
  });

  render(<BragDoc entries={[sampleEntry()]} />);
  fireEvent.click(screen.getByRole("button", { name: /generate/i }));
  await screen.findByText("Led X");

  fireEvent.click(screen.getByRole("button", { name: /copy to clipboard/i }));

  await waitFor(() => {
    expect(screen.getByText(/could not copy/i)).toBeInTheDocument();
  });
  // And the button should NOT be showing "Copied" falsely
  expect(screen.queryByRole("button", { name: /^copied$/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/components/BragDoc.test.tsx -t "clipboard"`
Expected: FAIL — current code fires-and-forgets the promise, so the button flips to "Copied" and no error appears.

- [ ] **Step 3: Rewrite `copyToClipboard`**

In `frontend/src/components/BragDoc.tsx`, replace the function (lines 71–82) with:

```ts
function copyToClipboard() {
  if (!bullets) return;
  const text = bullets
    .map(
      (group) =>
        `${group.tag.toUpperCase()}\n${group.points.map((p) => `- ${p}`).join("\n")}`
    )
    .join("\n\n");
  navigator.clipboard.writeText(text).then(
    () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    () => {
      setError("Could not copy to clipboard.");
    }
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd frontend && npx vitest run src/components/BragDoc.test.tsx`
Expected: all BragDoc tests pass.

- [ ] **Step 5: Stop for commit**

Suggested message: `fix: surface clipboard write failures`

---

## Task 13: Complete tab semantics (tablist + tabpanel + aria-controls)

**Files:**
- Modify: `frontend/src/components/App.tsx`
- Modify: `frontend/src/components/App.test.tsx` (add test)

Current state: each tab has `role="tab"` and `aria-selected`, but there's no `role="tablist"` on `<nav>` and no `role="tabpanel"` on the per-tab content. Screen readers won't treat this as a tab pattern.

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/App.test.tsx`:

```tsx
it("exposes ARIA tablist and tabpanel semantics", () => {
  render(<App />);
  // nav has role=tablist
  expect(screen.getByRole("tablist")).toBeInTheDocument();

  // Active tab links to its panel via aria-controls
  const journalTab = screen.getByRole("tab", { name: /journal/i });
  const panelId = journalTab.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();

  const panel = document.getElementById(panelId!);
  expect(panel).not.toBeNull();
  expect(panel!.getAttribute("role")).toBe("tabpanel");
  expect(panel!.getAttribute("aria-labelledby")).toBe(journalTab.id);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/components/App.test.tsx -t "tablist"`
Expected: FAIL — no element has `role="tablist"`.

- [ ] **Step 3: Wire up tablist and tabpanel**

In `frontend/src/components/App.tsx`:

(a) Add `role="tablist"` to the `<nav>` (around line 145):

```tsx
<nav
  role="tablist"
  style={{
    display: "flex",
    padding: "28px 40px 0",
    borderBottom: "1px solid var(--color-border-subtle)",
  }}
  className="animate-in animate-delay-1"
>
```

(b) For each tab button (around line 153 in the `TABS.map`), give it a stable `id` and `aria-controls`:

```tsx
{TABS.map(({ key, label }) => (
  <button
    key={key}
    id={`tab-${key}`}
    role="tab"
    aria-selected={tab === key}
    aria-controls={`tabpanel-${key}`}
    onClick={() => setTab(key)}
    /* …rest of style/className unchanged… */
  >
    {label}
  </button>
))}
```

(c) Wrap each tab's content div with `role="tabpanel"`, `id`, `aria-labelledby`:

Replace:

```tsx
{tab === "journal" && (
  <div>
    {/* …journal content… */}
  </div>
)}
```

with:

```tsx
{tab === "journal" && (
  <div role="tabpanel" id="tabpanel-journal" aria-labelledby="tab-journal">
    {/* …journal content… */}
  </div>
)}
```

Do the same pattern for the `bragdoc` and `settings` content divs (keep their existing `className="animate-in animate-delay-2"` — add `role`/`id`/`aria-labelledby` alongside it).

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: all App tests pass.

- [ ] **Step 5: Stop for commit**

Suggested message: `a11y: complete tablist/tabpanel semantics`

---

## Task 14: `aria-live` for reframe status and error

**Files:**
- Modify: `frontend/src/components/App.tsx:194-219`

- [ ] **Step 1: Add `role="status" aria-live="polite"` to the loading message**

In `frontend/src/components/App.tsx`, the `reframeLoading` block (around lines 194–207) currently renders a bare `<p>`. Wrap or annotate it:

```tsx
{reframeLoading && (
  <p
    role="status"
    aria-live="polite"
    style={{
      color: "var(--color-text-tertiary)",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      letterSpacing: "0.05em",
      marginTop: "24px",
      animation: "shimmer 1.5s ease-in-out infinite",
    }}
  >
    Reframing your entry...
  </p>
)}
```

- [ ] **Step 2: Add `role="alert" aria-live="assertive"` to the error message**

For the `reframeError` block (around lines 209–219):

```tsx
{reframeError && (
  <p
    role="alert"
    aria-live="assertive"
    style={{
      color: "var(--color-danger)",
      fontSize: "14px",
      marginTop: "24px",
    }}
  >
    {reframeError}
  </p>
)}
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: all tests pass (none rely on these nodes lacking roles).

- [ ] **Step 4: Stop for commit**

Suggested message: `a11y: announce reframe status and error to screen readers`

---

## Task 15: `aria-label` on BragDoc date-range select

**Files:**
- Modify: `frontend/src/components/BragDoc.tsx:88-107`

- [ ] **Step 1: Add `aria-label` to the `<select>`**

In `frontend/src/components/BragDoc.tsx`, add `aria-label="Date range"` to the `<select>`:

```tsx
<select
  aria-label="Date range"
  value={range}
  onChange={(e) => setRange(e.target.value as DateRange)}
  /* …style unchanged… */
>
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm test -- --run`
Expected: all tests pass.

- [ ] **Step 3: Stop for commit**

Suggested message: `a11y: label BragDoc date-range select`

---

## Task 16: Implement the 800 ms save ceremony

**Files:**
- Modify: `frontend/src/components/EntryForm.tsx`
- Modify: `frontend/src/components/EntryForm.test.tsx`

Spec (`docs/superpowers/specs/ui-design.md` § "Save Interaction (Ceremony)") requires:
1. Save button flashes / "Saved" text, amber glow.
2. Textarea border briefly turns green.
3. "Win logged" toast.
4. **After 800ms, textarea clears.**
5. Toast disappears after 2s.

Current behavior: textarea clears synchronously at the moment `onSave` is called. This step defers only the textarea clear — the reframe card mount is already driven by the API response timing in `App`, which in practice happens after 800ms.

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/EntryForm.test.tsx`:

```tsx
it("clears the textarea ~800ms after save, not immediately", async () => {
  vi.useFakeTimers();
  const onSave = vi.fn();
  render(<EntryForm prompt="?" onSave={onSave} />);
  const textarea = screen.getByPlaceholderText(/write about your win/i);
  fireEvent.change(textarea, { target: { value: "shipped it" } });
  fireEvent.click(screen.getByRole("button", { name: /save/i }));

  // onSave fires immediately
  expect(onSave).toHaveBeenCalledWith({
    original: "shipped it",
    tags: [],
  });

  // But the textarea is not cleared yet
  expect((textarea as HTMLTextAreaElement).value).toBe("shipped it");

  // After 800ms it clears
  await vi.advanceTimersByTimeAsync(800);
  expect((textarea as HTMLTextAreaElement).value).toBe("");

  vi.useRealTimers();
});
```

Also **update** the existing test (if present) that asserts synchronous clear — replace it with the new delayed behavior. Read the file first to see which test to modify.

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/components/EntryForm.test.tsx -t "800"`
Expected: FAIL — textarea is cleared synchronously.

- [ ] **Step 3: Update `handleSubmit` in `EntryForm.tsx`**

Replace lines 16–26 of `frontend/src/components/EntryForm.tsx` with:

```ts
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!text.trim()) return;
  onSave({ original: text.trim(), tags });

  setSaved(true);
  setTimeout(() => setSaved(false), 2000);

  setTimeout(() => {
    setText("");
    setTags([]);
  }, 800);
}
```

- [ ] **Step 4: Update the Playwright test that depends on immediate clear**

`frontend/e2e/journal.spec.ts` has a test "clears textarea after save" that does not account for the 800 ms delay. Update it to wait:

```ts
test("clears textarea after save", async ({ page }) => {
  const textarea = page.locator('textarea[placeholder="Write about your win..."]');
  await textarea.fill("Something great");
  await page.click('button:has-text("Save")');
  await expect(textarea).toHaveValue("", { timeout: 2000 });
});
```

The `{ timeout: 2000 }` gives enough slack for the 800 ms `setTimeout`.

- [ ] **Step 5: Run unit tests**

Run: `cd frontend && npx vitest run src/components/EntryForm.test.tsx`
Expected: all EntryForm tests pass.

- [ ] **Step 6: Stop for commit**

Suggested message: `feat: defer textarea clear to complete 800ms save ceremony`

---

## Task 17: Add Settings pill to the header

**Files:**
- Modify: `frontend/src/components/App.tsx` (header block)
- Modify: `frontend/src/components/App.test.tsx` (add test)

Spec: "Settings as a small pill-shaped button in the top-right corner, reducing the need for a separate Settings tab (though the tab is retained for discoverability)." The tab stays — we're adding a shortcut.

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/App.test.tsx`:

```tsx
it("has a Settings pill in the header that activates the Settings tab", () => {
  render(<App />);
  const pill = screen.getByRole("button", { name: /open settings/i });
  expect(pill).toBeInTheDocument();

  fireEvent.click(pill);
  // Settings tab's panel should now be visible
  expect(screen.getByRole("tabpanel", { name: /settings/i })).toBeInTheDocument();
});
```

(The test assumes Task 13 has landed — the tabpanel has `aria-labelledby="tab-settings"`, which RTL will use to resolve the accessible name.)

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/components/App.test.tsx -t "pill"`
Expected: FAIL — no element with that role/name.

- [ ] **Step 3: Add the pill to the header**

In `frontend/src/components/App.tsx`, update the right-side header group (around lines 127–142) to include a pill button before the date:

```tsx
<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
  <button
    type="button"
    aria-label="Open settings"
    onClick={() => setTab("settings")}
    style={{
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      padding: "6px 14px",
      borderRadius: "999px",
      border: "1px solid var(--color-border)",
      background: "var(--color-surface)",
      color: "var(--color-text-secondary)",
      cursor: "pointer",
      transition: "background 0.15s, color 0.15s",
    }}
  >
    Settings
  </button>
  <span
    style={{
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      color: "var(--color-text-tertiary)",
      letterSpacing: "0.05em",
    }}
  >
    {new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    })}
  </span>
</div>
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: all App tests pass.

- [ ] **Step 5: Stop for commit**

Suggested message: `feat: add Settings pill to header`

---

## Task 18: Edit reframed text before Accept

**Files:**
- Modify: `frontend/src/components/ReframeView.tsx`
- Modify: `frontend/src/components/App.tsx` (adapt `handleAcceptReframe` signature)
- Modify: `frontend/src/components/ReframeView.test.tsx` (add test)

Spec (`tech-spec.md` § "Journal Tab" step 5): "User can dismiss the reframing, **edit it**, or accept it (which updates the `original` field in localStorage to the reframed text)." Currently the reframed column is plain `<p>` — no edit.

Approach: make the reframed column an editable `<textarea>` seeded with the model's reframe, and pass its current value to `onAccept` on click.

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/ReframeView.test.tsx`:

```tsx
it("lets the user edit the reframed text and passes the edited value to onAccept", () => {
  const onAccept = vi.fn();
  render(
    <ReframeView
      original="I kind of helped"
      reframed="Led the X initiative"
      onAccept={onAccept}
      onDismiss={() => {}}
    />
  );

  const editable = screen.getByLabelText(/reframed/i);
  fireEvent.change(editable, {
    target: { value: "Led the X initiative end-to-end" },
  });
  fireEvent.click(screen.getByRole("button", { name: /accept/i }));

  expect(onAccept).toHaveBeenCalledWith("Led the X initiative end-to-end");
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd frontend && npx vitest run src/components/ReframeView.test.tsx -t "edit"`
Expected: FAIL — `onAccept` currently takes no args; no editable element.

- [ ] **Step 3: Update `ReframeView`**

Replace the contents of `frontend/src/components/ReframeView.tsx` with:

```tsx
"use client";

import { useState } from "react";

interface ReframeViewProps {
  original: string;
  reframed: string;
  onAccept: (finalText: string) => void;
  onDismiss: () => void;
}

export function ReframeView({
  original,
  reframed,
  onAccept,
  onDismiss,
}: ReframeViewProps) {
  const [edited, setEdited] = useState(reframed);

  return (
    <div
      style={{
        position: "relative",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-accent-border)",
        overflow: "hidden",
        animation: "reframeReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <div
        style={{
          height: "2px",
          background:
            "linear-gradient(to right, var(--color-accent), transparent)",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px 0",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
          }}
        >
          AI Reframe
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.05em",
          }}
        >
          side-by-side
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "0",
          padding: "20px 24px",
        }}
      >
        <div style={{ paddingRight: "20px" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              marginBottom: "10px",
            }}
          >
            Your version
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-text-tertiary)",
              lineHeight: 1.6,
            }}
          >
            {original}
          </p>
        </div>

        <div
          style={{
            width: "1px",
            background:
              "linear-gradient(to bottom, var(--color-accent-border), var(--color-border-subtle))",
          }}
        />

        <div style={{ paddingLeft: "20px" }}>
          <label
            htmlFor="reframe-edit"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              marginBottom: "10px",
              display: "block",
            }}
          >
            Reframed
          </label>
          <textarea
            id="reframe-edit"
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px dashed var(--color-accent-border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 10px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "0 24px 20px",
        }}
      >
        <button
          onClick={() => onAccept(edited)}
          style={{
            padding: "8px 20px",
            background: "var(--color-accent)",
            color: "var(--color-base)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Accept
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: "8px 20px",
            background: "var(--color-surface-raised)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `App.handleAcceptReframe` to accept the final text**

In `frontend/src/components/App.tsx`, replace the existing `handleAcceptReframe` (around lines 77–82) with:

```ts
function handleAcceptReframe(finalText: string) {
  if (!reframing) return;
  updateEntry(reframing.entryId, { original: finalText, reframed: finalText });
  refreshEntries();
  setReframing(null);
}
```

The `reframed: finalText` write keeps the saved entry's reframed field in sync with the edited version. If you'd prefer to only overwrite `original` (matching the spec's exact wording), drop the second field.

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run src/components/ReframeView.test.tsx src/components/App.test.tsx`
Expected: all tests pass.

- [ ] **Step 6: Stop for commit**

Suggested message: `feat: edit reframed text before accept`

---

## Task 19: Minimal Settings privacy copy rewrite

**Files:**
- Modify: `frontend/src/components/Settings.tsx:35-45`

Current copy misleads: it says entries "never leave your device," but they're sent to Anthropic for reframing and brag-doc generation.

- [ ] **Step 1: Update the paragraph text**

In `frontend/src/components/Settings.tsx`, replace the current `<p>` (lines 35–45):

```tsx
<p
  style={{
    fontSize: "14px",
    color: "var(--color-text-secondary)",
    lineHeight: 1.6,
    marginBottom: "24px",
  }}
>
  Your journal entries are stored locally in this browser. Entry text is
  sent to Anthropic only when you reframe an entry or generate a brag doc,
  and is not stored on our servers.
</p>
```

- [ ] **Step 2: Update any Settings test that asserts on the old copy**

Read `frontend/src/components/Settings.test.tsx`:

Run: `grep -n "never leave" frontend/src/components/Settings.test.tsx`
If there's a match, update the assertion to the new copy (e.g., `expect(screen.getByText(/sent to Anthropic/i))`).

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/Settings.test.tsx`
Expected: all tests pass.

- [ ] **Step 4: Stop for commit**

Suggested message: `docs(ui): clarify that entries are sent to Anthropic for AI features`

---

## Task 20: Update ui-design.md to drop strikethrough requirement

**Files:**
- Modify: `docs/superpowers/specs/ui-design.md`

Decision: strikethrough of self-diminishing words will not be implemented. Update the spec so future reviewers don't flag it as a gap.

- [ ] **Step 1: Edit the ReframeView spec**

In `docs/superpowers/specs/ui-design.md`, find the ReframeView section. The line currently reads:

```
- Left column: "Your version" label (muted), original text in secondary color, self-diminishing words shown with strikethrough
```

Replace with:

```
- Left column: "Your version" label (muted), original text in secondary color
```

Also update the right-column line if it references the same diffing shape. Leave everything else in the ReframeView bullet list intact.

- [ ] **Step 2: Search for any other mention of strikethrough**

Run: `grep -n "strikethrough\|self-diminish" docs/superpowers/specs/ui-design.md`
Expected: no matches left (or only matches unrelated to the dropped feature).

- [ ] **Step 3: Stop for commit**

Suggested message: `docs: drop strikethrough-on-diminishing-words from ReframeView spec`

---

## Task 21: Add test for the Accept flow in `App.test.tsx`

**Files:**
- Modify: `frontend/src/components/App.test.tsx`

The core differentiating path — save → reframe → accept → entry's `original` is mutated to the reframed text — has no unit test. Add one.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/App.test.tsx`:

```tsx
it("accept flow: saving then accepting reframe overwrites original with the (possibly edited) reframed text", async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ reframed: "Led the release" }),
  });

  render(<App />);
  const textarea = screen.getByPlaceholderText(/write about your win/i);
  fireEvent.change(textarea, { target: { value: "I helped with the release" } });
  fireEvent.click(screen.getByRole("button", { name: /save/i }));

  // Wait for reframe card to appear
  await screen.findByRole("button", { name: /accept/i });
  fireEvent.click(screen.getByRole("button", { name: /accept/i }));

  // Verify the stored entry's `original` was overwritten
  const stored = JSON.parse(
    localStorage.getItem("confidence-journal-entries") || "[]"
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].original).toBe("Led the release");
});
```

- [ ] **Step 2: Run the test, verify it passes (or fix regressions)**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: the new test passes. If Task 18 has landed, the `original` was overwritten with the edited reframe.

- [ ] **Step 3: Stop for commit**

Suggested message: `test: cover save → reframe → accept happy path`

---

## Task 22: Stub AI routes in Playwright tests

**Files:**
- Modify: `frontend/e2e/journal.spec.ts`
- Modify: `frontend/e2e/brag-doc.spec.ts`

Current state: Playwright's save-flow test clicks Save, which triggers a real `/api/reframe` → live Anthropic call. Slow, flaky, costs money, depends on `ANTHROPIC_API_KEY` being set.

- [ ] **Step 1: Stub `/api/reframe` in `journal.spec.ts`**

In `frontend/e2e/journal.spec.ts`, extend the `beforeEach` block:

```ts
test.beforeEach(async ({ page }) => {
  await page.route("**/api/reframe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reframed: "A confident version of your win." }),
    })
  );
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
```

- [ ] **Step 2: Stub `/api/generate-brag-doc` in `brag-doc.spec.ts`**

Read the current file first:

Run: `cat frontend/e2e/brag-doc.spec.ts`

Then in its `beforeEach`, add:

```ts
await page.route("**/api/generate-brag-doc", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      bullets: [
        { tag: "leadership", points: ["Led the standup"] },
      ],
    }),
  })
);
```

before the `page.goto("/")`.

- [ ] **Step 3: Run the Playwright suite**

Run: `cd frontend && npm run test:e2e`
Expected: all Playwright tests pass. No outgoing network call to `api.anthropic.com`.

- [ ] **Step 4: Stop for commit**

Suggested message: `test(e2e): stub /api/reframe and /api/generate-brag-doc`

---

## Task 23: Final verification

- [ ] **Step 1: Full unit-test run**

Run: `cd frontend && npm test -- --run`
Expected: all tests pass. Note the total count — should be higher than the starting 45.

- [ ] **Step 2: Full Playwright run**

Run: `cd frontend && npm run test:e2e`
Expected: all pass.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: no warnings or errors.

- [ ] **Step 5: Production build**

Run: `cd frontend && npm run build`
Expected: build succeeds, no new warnings.

- [ ] **Step 6: Manual smoke test**

Run: `cd frontend && npm run dev`

In a browser at `http://localhost:3000`:
1. Today's prompt shows.
2. Click the **Settings pill** in the header → Settings tab opens.
3. Go back to Journal. Write an entry, pick tags, Save.
4. "Win logged" toast appears; textarea clears ~800 ms later.
5. Reframe card appears; edit the reframed text; click **Accept**.
6. Entry in the list shows the edited text.
7. Switch to Brag Doc → Generate → see grouped bullets → Copy to clipboard → "Copied" flashes.
8. Try generating with DevTools offline: verify the error message shows and the button returns to "Generate".
9. Reload the page with DevTools Application → localStorage → value manually set to `"{broken"` → app renders empty-state instead of crashing.

- [ ] **Step 7: Stop for final commit (if any dangling changes)**

Suggested message: `chore: final cleanup after code-review fixes`

---

## Self-Review Summary (run by plan author)

- **Spec coverage:** 7 bug fixes (1–7), 3 a11y items (13–15), 4 cleanup items (1–4, 8), API route hardening (9), 3 UI/robustness (10–12), 3 spec-gap implementations (16–18), privacy copy (19), strikethrough spec update (20), Accept-flow test (21), Playwright stubbing (22), final verification (23). All 16 in-scope review items plus the user-approved spec gaps are covered.
- **Placeholder scan:** none — every step has the exact file path, code, or command.
- **Type consistency:** `onAccept: (finalText: string) => void` (Task 18) is matched by `handleAcceptReframe(finalText: string)` in `App` (Task 18 step 4), and by the test assertion `onAccept).toHaveBeenCalledWith("Led the X…")`. `saving?: boolean` on `EntryForm` (Task 10) is passed from `App` as `saving={reframeLoading}`. `todayLocal()` and `localDateFromOffset(daysAgo: number)` (Task 5) are used by name in Tasks 5's two consumer edits.
- **Git convention:** every task ends with "Stop for commit" — matches the user's manual-commit preference.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-code-review-fixes.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good fit here because tasks are independently testable and the plan is long.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach?
