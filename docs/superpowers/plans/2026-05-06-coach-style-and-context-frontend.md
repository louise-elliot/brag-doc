# Coaching Style and User Context — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the frontend half of the coaching style + user context feature: a Settings UI (style picker + context fields), a `settings.ts` data module, and the request-side wiring that threads `coaching_style` and `user_context` into the coach + brag-doc API calls.

**Architecture:** New `frontend/src/lib/settings.ts` mirrors the shape of `entries.ts` (read/merge-write helpers + a `serializeContext` helper that returns `null` when both context fields are blank). Settings UI binds directly to that module. Coach + brag-doc components read settings at request time and tack the new fields onto their existing API requests. Backend is **out of scope** for this plan — the FastAPI Pydantic models on the existing endpoints will accept the new fields once the user adds them in their separate backend pass; today's backend ignores unknown fields, so frontend tests run green against mocks regardless.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Vitest + React Testing Library, Playwright. localStorage for persistence.

**Spec:** `docs/superpowers/specs/coach-style-and-context-design.md`

---

## File Structure

**Create:**
- `frontend/src/lib/settings.ts` — read/write/serialize helpers
- `frontend/src/lib/settings.test.ts` — unit tests for the module
- `frontend/e2e/settings-coach.spec.ts` — end-to-end test

**Modify:**
- `frontend/src/lib/types.ts` — add `CoachingStyle`, `UserContext`, `UserSettings`, `COACHING_STYLE_OPTIONS`
- `frontend/src/lib/coachApi.ts` — extend `CoachTurnRequest` / `CoachReframeRequest` with `coaching_style` + `user_context`
- `frontend/src/lib/coachApi.test.ts` — assert the new fields land in the POST body
- `frontend/src/components/Settings.tsx` — add `CoachingStyleCard` and `ContextCard`, slot them above `CategoriesCard`
- `frontend/src/components/Settings.test.tsx` — tests for the two new cards
- `frontend/src/components/CoachPanel.tsx` — read settings, pass into `coachTurn` / `coachReframe`
- `frontend/src/components/CoachPanel.test.tsx` — assert the new fields are sent
- `frontend/src/components/BragDoc.tsx` — read settings, include `user_context` in the brag-doc fetch body
- `frontend/src/components/BragDoc.test.tsx` — assert `user_context` lands in the brag-doc fetch body

All work runs from `frontend/` as the working directory.

---

## Task 1: Add types

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Step 1: Add types and the style options list**

Append to `frontend/src/lib/types.ts`:

```typescript
export type CoachingStyle =
  | "trusted-mentor"
  | "hype-woman"
  | "direct-challenger"
  | "bold-coach";

export interface UserContext {
  headline: string;
  notes: string;
}

export interface UserSettings {
  coachingStyle: CoachingStyle;
  contextHeadline: string;
  contextNotes: string;
}

export interface CoachingStyleOption {
  key: CoachingStyle;
  label: string;
  descriptor: string;
}

export const COACHING_STYLE_OPTIONS: CoachingStyleOption[] = [
  {
    key: "trusted-mentor",
    label: "The Trusted Mentor",
    descriptor:
      "Warm, wise, unhurried. Gentle nudges. Best for women who find direct feedback triggering.",
  },
  {
    key: "hype-woman",
    label: "The Hype Woman",
    descriptor:
      "High energy, celebratory, zero tolerance for shrinking. Best for women who need an energy boost and respond well to enthusiasm.",
  },
  {
    key: "direct-challenger",
    label: "The Direct Challenger",
    descriptor:
      "High challenge, low ceremony. Cuts to the chase. Best for women who don't like the 'fluff'.",
  },
  {
    key: "bold-coach",
    label: "The Bold Coach",
    descriptor:
      "Playful, punchy, modern. Best for younger users or anyone who wants coaching to feel less like work.",
  },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  coachingStyle: "trusted-mentor",
  contextHeadline: "",
  contextNotes: "",
};
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: PASS (no callers yet, so no breakage).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "Add CoachingStyle/UserContext/UserSettings types"
```

---

## Task 2: settings.ts module (TDD)

**Files:**
- Create: `frontend/src/lib/settings.ts`
- Create: `frontend/src/lib/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/settings.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { readSettings, writeSettings, serializeContext } from "./settings";
import { DEFAULT_USER_SETTINGS } from "./types";

const KEY = "confidence-journal-settings";

describe("settings data layer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when localStorage key is missing", () => {
    expect(readSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("returns defaults when localStorage value is not valid JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("returns defaults when localStorage value is JSON but not an object", () => {
    localStorage.setItem(KEY, JSON.stringify(["nope"]));
    expect(readSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("tolerates partial blobs by filling in missing fields with defaults", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ coachingStyle: "hype-woman" })
    );
    expect(readSettings()).toEqual({
      ...DEFAULT_USER_SETTINGS,
      coachingStyle: "hype-woman",
    });
  });

  it("falls back to default when stored coachingStyle is not a known value", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ coachingStyle: "made-up-style" })
    );
    expect(readSettings().coachingStyle).toBe(
      DEFAULT_USER_SETTINGS.coachingStyle
    );
  });

  it("does not write to storage on read", () => {
    readSettings();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("writeSettings merges rather than clobbering", () => {
    writeSettings({ contextHeadline: "Senior backend engineer" });
    writeSettings({ contextNotes: "Working towards staff" });
    expect(readSettings()).toEqual({
      ...DEFAULT_USER_SETTINGS,
      contextHeadline: "Senior backend engineer",
      contextNotes: "Working towards staff",
    });
  });
});

describe("serializeContext", () => {
  it("returns null when both context fields are empty strings", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "",
        contextNotes: "",
      })
    ).toBeNull();
  });

  it("returns null when both context fields are whitespace only", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "   ",
        contextNotes: "\n\n",
      })
    ).toBeNull();
  });

  it("returns headline and notes when at least one field has content", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "Senior PM",
        contextNotes: "",
      })
    ).toEqual({ headline: "Senior PM", notes: "" });
  });

  it("preserves the raw values without trimming so the user's formatting survives", () => {
    expect(
      serializeContext({
        ...DEFAULT_USER_SETTINGS,
        contextHeadline: "  Senior PM  ",
        contextNotes: "Line 1\nLine 2",
      })
    ).toEqual({ headline: "  Senior PM  ", notes: "Line 1\nLine 2" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: FAIL — module `./settings` not found.

- [ ] **Step 3: Implement settings.ts**

Create `frontend/src/lib/settings.ts`:

```typescript
import {
  COACHING_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
  type UserContext,
  type UserSettings,
} from "./types";

const STORAGE_KEY = "confidence-journal-settings";

const VALID_STYLES = new Set<CoachingStyle>(
  COACHING_STYLE_OPTIONS.map((option) => option.key)
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceCoachingStyle(value: unknown): CoachingStyle {
  if (typeof value === "string" && VALID_STYLES.has(value as CoachingStyle)) {
    return value as CoachingStyle;
  }
  return DEFAULT_USER_SETTINGS.coachingStyle;
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function readSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_USER_SETTINGS;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_USER_SETTINGS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
  if (!isPlainObject(parsed)) return DEFAULT_USER_SETTINGS;
  return {
    coachingStyle: coerceCoachingStyle(parsed.coachingStyle),
    contextHeadline: coerceString(
      parsed.contextHeadline,
      DEFAULT_USER_SETTINGS.contextHeadline
    ),
    contextNotes: coerceString(
      parsed.contextNotes,
      DEFAULT_USER_SETTINGS.contextNotes
    ),
  };
}

export function writeSettings(partial: Partial<UserSettings>): void {
  if (typeof window === "undefined") return;
  const next: UserSettings = { ...readSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function serializeContext(settings: UserSettings): UserContext | null {
  if (
    settings.contextHeadline.trim() === "" &&
    settings.contextNotes.trim() === ""
  ) {
    return null;
  }
  return {
    headline: settings.contextHeadline,
    notes: settings.contextNotes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/settings.ts frontend/src/lib/settings.test.ts
git commit -m "Add settings module with readSettings/writeSettings/serializeContext"
```

---

## Task 3: Extend coach API request types

**Files:**
- Modify: `frontend/src/lib/coachApi.ts`
- Modify: `frontend/src/lib/coachApi.test.ts`

- [ ] **Step 1: Update existing tests to assert the new fields**

In `frontend/src/lib/coachApi.test.ts`, change the `sampleArgs` block at the top so it includes the new fields, and update the body-assertion expectations. Replace the existing `sampleArgs` with:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { coachTurn, coachReframe, type CoachMessage } from "./coachApi";

const sampleArgs = {
  entry_text: "Led the rollout",
  prompt: "What did you ship?",
  tags: ["leadership"],
  conversation: [] as CoachMessage[],
  coaching_style: "hype-woman" as const,
  user_context: { headline: "Senior PM", notes: "Pre-promo to director" },
};
```

The two `expect(globalThis.fetch).toHaveBeenCalledWith(...)` assertions in the file pass `body: JSON.stringify(sampleArgs)` — those will now expect the new fields to be included verbatim. Leave them as-is; just verifying that the call below still uses `sampleArgs` is enough.

Add one new test below the existing `coachTurn` happy-path test:

```typescript
  it("coachTurn defaults are caller's responsibility — null user_context is sent verbatim", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ text: "ok", notes: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    await coachTurn({
      entry_text: "x",
      prompt: "y",
      tags: [],
      conversation: [],
      coaching_style: "trusted-mentor",
      user_context: null,
    });
    const body = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.coaching_style).toBe("trusted-mentor");
    expect(body.user_context).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/coachApi.test.ts`
Expected: FAIL — TypeScript errors that `coaching_style` / `user_context` aren't valid keys on the request type.

- [ ] **Step 3: Extend the request types**

Edit `frontend/src/lib/coachApi.ts`. At the top of the file, import the shared types and re-export `UserContext` for callers:

```typescript
import type { CoachingStyle, UserContext } from "./types";

export type { CoachingStyle, UserContext };
```

Then update both request interfaces to add the two new fields:

```typescript
export interface CoachTurnRequest {
  entry_text: string;
  prompt: string;
  tags: string[];
  conversation: CoachMessage[];
  coaching_style: CoachingStyle;
  user_context: UserContext | null;
}

export interface CoachReframeRequest {
  entry_text: string;
  prompt: string;
  tags: string[];
  conversation: CoachMessage[];
  coaching_style: CoachingStyle;
  user_context: UserContext | null;
}
```

Leave the function bodies and `postJson` helper untouched — `JSON.stringify` already serialises every property on the request object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/coachApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/coachApi.ts frontend/src/lib/coachApi.test.ts
git commit -m "Extend coach API requests with coaching_style and user_context"
```

---

## Task 4: CoachingStyleCard in Settings.tsx

**Files:**
- Modify: `frontend/src/components/Settings.tsx`
- Modify: `frontend/src/components/Settings.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/Settings.test.tsx`, add a new `describe` block at the bottom of the file:

```typescript
import { readSettings } from "@/lib/settings";

describe("Settings — Coaching Style card", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderSettings() {
    render(
      <Settings
        tags={[]}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={vi.fn()}
        onClearData={vi.fn()}
      />
    );
  }

  it("renders all four coaching styles with labels", () => {
    renderSettings();
    expect(screen.getByText("The Trusted Mentor")).toBeInTheDocument();
    expect(screen.getByText("The Hype Woman")).toBeInTheDocument();
    expect(screen.getByText("The Direct Challenger")).toBeInTheDocument();
    expect(screen.getByText("The Bold Coach")).toBeInTheDocument();
  });

  it("marks The Trusted Mentor as selected by default", () => {
    renderSettings();
    const radio = screen.getByRole("radio", { name: /the trusted mentor/i });
    expect(radio).toHaveAttribute("aria-checked", "true");
  });

  it("persists a different style on click", async () => {
    renderSettings();
    await userEvent.click(
      screen.getByRole("radio", { name: /the hype woman/i })
    );
    expect(readSettings().coachingStyle).toBe("hype-woman");
  });

  it("hydrates the selected style from localStorage on mount", () => {
    localStorage.setItem(
      "confidence-journal-settings",
      JSON.stringify({ coachingStyle: "bold-coach" })
    );
    renderSettings();
    const radio = screen.getByRole("radio", { name: /the bold coach/i });
    expect(radio).toHaveAttribute("aria-checked", "true");
  });
});
```

If `beforeEach` and `vi` aren't already imported at the top of the file, add them. Same for `userEvent`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Settings.test.tsx`
Expected: FAIL — "Trusted Mentor" / radios not found.

- [ ] **Step 3: Add the CoachingStyleCard component**

Edit `frontend/src/components/Settings.tsx`. At the top, import the new dependencies:

```typescript
import { useEffect, useState } from "react";
import {
  PALETTE,
  isDuplicateName,
  nextUnusedColor,
  type TagDef,
} from "@/lib/tags";
import {
  COACHING_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
} from "@/lib/types";
import { readSettings, writeSettings } from "@/lib/settings";
```

Inside the `Settings` component, add `<CoachingStyleCard />` as the **first** child of the outer `div`, above the existing `<CategoriesCard />`:

```tsx
return (
  <div style={{ paddingTop: "48px", display: "flex", flexDirection: "column", gap: "24px" }}>
    <CoachingStyleCard />
    <CategoriesCard
      // ...existing props
    />
    <DataCard
      // ...existing props
    />
  </div>
);
```

Then add the new component at the bottom of the file:

```tsx
function CoachingStyleCard() {
  const [style, setStyle] = useState<CoachingStyle>(
    DEFAULT_USER_SETTINGS.coachingStyle
  );

  useEffect(() => {
    setStyle(readSettings().coachingStyle);
  }, []);

  function pick(next: CoachingStyle) {
    setStyle(next);
    writeSettings({ coachingStyle: next });
  }

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "28px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: "16px",
        }}
      >
        Coaching Style
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: "20px",
        }}
      >
        Pick the voice that works best for you. You can change this any time.
      </p>
      <div
        role="radiogroup"
        aria-label="Coaching style"
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {COACHING_STYLE_OPTIONS.map((option) => {
          const selected = style === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              onClick={() => pick(option.key)}
              style={{
                textAlign: "left",
                padding: "16px 18px",
                background: selected
                  ? "var(--color-accent-muted)"
                  : "transparent",
                border: selected
                  ? "1px solid var(--color-accent-border)"
                  : "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  marginBottom: "4px",
                }}
              >
                {option.label}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {option.descriptor}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/Settings.test.tsx
git commit -m "Add Coaching Style card to Settings"
```

---

## Task 5: ContextCard in Settings.tsx

**Files:**
- Modify: `frontend/src/components/Settings.tsx`
- Modify: `frontend/src/components/Settings.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append a second `describe` block to `Settings.test.tsx`:

```typescript
describe("Settings — Your Context card", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderSettings() {
    render(
      <Settings
        tags={[]}
        onAddTag={vi.fn()}
        onDeleteTag={vi.fn()}
        onRenameTag={vi.fn()}
        onClearData={vi.fn()}
      />
    );
  }

  it("renders the headline input and notes textarea", () => {
    renderSettings();
    expect(
      screen.getByRole("textbox", { name: /headline/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /what else should the coach know/i })
    ).toBeInTheDocument();
  });

  it("persists the headline on blur", async () => {
    renderSettings();
    const headline = screen.getByRole("textbox", { name: /headline/i });
    await userEvent.type(headline, "Senior backend engineer");
    headline.blur();
    expect(readSettings().contextHeadline).toBe("Senior backend engineer");
  });

  it("persists the notes textarea on blur", async () => {
    renderSettings();
    const notes = screen.getByRole("textbox", {
      name: /what else should the coach know/i,
    });
    await userEvent.type(notes, "Working towards staff");
    notes.blur();
    expect(readSettings().contextNotes).toBe("Working towards staff");
  });

  it("hydrates both fields from localStorage on mount", () => {
    localStorage.setItem(
      "confidence-journal-settings",
      JSON.stringify({
        contextHeadline: "Stored headline",
        contextNotes: "Stored notes",
      })
    );
    renderSettings();
    expect(screen.getByRole("textbox", { name: /headline/i })).toHaveValue(
      "Stored headline"
    );
    expect(
      screen.getByRole("textbox", { name: /what else should the coach know/i })
    ).toHaveValue("Stored notes");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Settings.test.tsx`
Expected: FAIL — context inputs not in the DOM.

- [ ] **Step 3: Add the ContextCard component**

In `frontend/src/components/Settings.tsx`, slot `<ContextCard />` between `<CoachingStyleCard />` and `<CategoriesCard />`:

```tsx
return (
  <div style={{ paddingTop: "48px", display: "flex", flexDirection: "column", gap: "24px" }}>
    <CoachingStyleCard />
    <ContextCard />
    <CategoriesCard
      // ...existing props
    />
    {/* ... */}
  </div>
);
```

Add the component at the bottom of the file:

```tsx
function ContextCard() {
  const [headline, setHeadline] = useState(
    DEFAULT_USER_SETTINGS.contextHeadline
  );
  const [notes, setNotes] = useState(DEFAULT_USER_SETTINGS.contextNotes);

  useEffect(() => {
    const stored = readSettings();
    setHeadline(stored.contextHeadline);
    setNotes(stored.contextNotes);
  }, []);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "28px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: "16px",
        }}
      >
        Your Context
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: "20px",
        }}
      >
        Helps the coach speak to where you are. None of this leaves your
        browser unless an entry is being reframed or a brag doc is being
        generated.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "6px" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            Headline
          </span>
          <input
            aria-label="Headline"
            value={headline}
            placeholder="e.g. Senior backend engineer at a fintech series-B"
            onChange={(e) => setHeadline(e.target.value)}
            onBlur={() => writeSettings({ contextHeadline: headline })}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </label>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "6px" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            What else should the coach know?
          </span>
          <textarea
            aria-label="What else should the coach know?"
            value={notes}
            placeholder="What are you working towards? What's invisible in your org? What does your manager value?"
            rows={5}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => writeSettings({ contextNotes: notes })}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              outline: "none",
              resize: "vertical",
              minHeight: "100px",
            }}
          />
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/Settings.test.tsx
git commit -m "Add Your Context card to Settings"
```

---

## Task 6: Wire CoachPanel to send coaching_style + user_context

**Files:**
- Modify: `frontend/src/components/CoachPanel.tsx`
- Modify: `frontend/src/components/CoachPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Open `frontend/src/components/CoachPanel.test.tsx` and add tests asserting that the chosen style and serialised context land in both the turn and reframe API calls. The test names below should slot into the existing `describe` blocks (or a new one). Adapt the imports and mock setup to match the existing file:

```typescript
import { readSettings, writeSettings } from "@/lib/settings";
import { coachTurn, coachReframe } from "@/lib/coachApi";

// ...inside the existing describe block, after current tests:

it("sends the user's coaching_style and serialized user_context on the first turn", async () => {
  writeSettings({
    coachingStyle: "hype-woman",
    contextHeadline: "Senior PM",
    contextNotes: "Pre-promo to director",
  });
  // ...mock coachTurn to resolve with a fake response, then render CoachPanel
  await waitFor(() => {
    expect(coachTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        coaching_style: "hype-woman",
        user_context: { headline: "Senior PM", notes: "Pre-promo to director" },
      })
    );
  });
});

it("sends user_context: null when both context fields are blank", async () => {
  writeSettings({
    coachingStyle: "trusted-mentor",
    contextHeadline: "",
    contextNotes: "",
  });
  // ...mock coachTurn, render CoachPanel
  await waitFor(() => {
    expect(coachTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        coaching_style: "trusted-mentor",
        user_context: null,
      })
    );
  });
});

it("forwards coaching_style and user_context on the reframe call", async () => {
  writeSettings({ coachingStyle: "bold-coach" });
  // ...render, click "Reframe it now", assert coachReframe called with coaching_style: "bold-coach"
});
```

Use the file's existing mocking pattern for `@/lib/coachApi` (likely `vi.mock("@/lib/coachApi", ...)`); if the file doesn't already mock those functions, set the mocks up at the top of the new tests. Read the current `CoachPanel.test.tsx` first to match its style.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CoachPanel.test.tsx`
Expected: FAIL — `coachTurn` is called without `coaching_style` / `user_context`.

- [ ] **Step 3: Wire CoachPanel to read settings**

Edit `frontend/src/components/CoachPanel.tsx`. Add the import:

```typescript
import { readSettings, serializeContext } from "@/lib/settings";
```

Inside the component, before the two `async function fetch...` definitions, add a small helper that reads settings at call time:

```typescript
function settingsFields() {
  const settings = readSettings();
  return {
    coaching_style: settings.coachingStyle,
    user_context: serializeContext(settings),
  };
}
```

Then update both fetch helpers to spread those fields into the request body:

```typescript
async function fetchTurn(history: ApiMessage[]) {
  setPhase({ kind: "loading-turn" });
  try {
    const result = await coachTurn({
      entry_text: entry.original,
      prompt: entry.prompt,
      tags: entry.tags,
      conversation: history,
      ...settingsFields(),
    });
    // ...rest unchanged
```

```typescript
async function fetchReframe() {
  setPhase({ kind: "loading-reframe" });
  try {
    const result = await coachReframe({
      entry_text: entry.original,
      prompt: entry.prompt,
      tags: entry.tags,
      conversation: messages,
      ...settingsFields(),
    });
    // ...rest unchanged
```

Reading settings inline (rather than at component mount) means a user who changes their style mid-conversation will see the change reflected on the *next* turn — which is the right behaviour for a settings tweak.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CoachPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CoachPanel.tsx frontend/src/components/CoachPanel.test.tsx
git commit -m "Wire CoachPanel to send coaching_style and user_context"
```

---

## Task 7: Wire BragDoc to send user_context

**Files:**
- Modify: `frontend/src/components/BragDoc.tsx`
- Modify: `frontend/src/components/BragDoc.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/BragDoc.test.tsx`, add a test asserting that `user_context` lands in the `/api/generate-brag-doc` POST body. Match the file's existing mock-fetch setup. Sketch:

```typescript
import { writeSettings } from "@/lib/settings";

it("sends serialized user_context with the generate request", async () => {
  writeSettings({
    contextHeadline: "Staff engineer",
    contextNotes: "Promo case to principal",
  });
  // ...mock fetch to return a successful brag-doc response, render BragDoc, click Generate
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const body = JSON.parse(calls[0][1].body);
  expect(body.user_context).toEqual({
    headline: "Staff engineer",
    notes: "Promo case to principal",
  });
});

it("sends user_context: null when no context is set", async () => {
  // ...localStorage cleared in beforeEach; render BragDoc, click Generate
  const body = JSON.parse(
    (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
  );
  expect(body.user_context).toBeNull();
});
```

Read the existing BragDoc test file first to match its rendering setup and `localStorage.clear()` pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BragDoc.test.tsx`
Expected: FAIL — `body.user_context` is undefined.

- [ ] **Step 3: Wire BragDoc to read settings**

Edit `frontend/src/components/BragDoc.tsx`. Add the import:

```typescript
import { readSettings, serializeContext } from "@/lib/settings";
```

In the `generate()` function, build the request body with `user_context`:

```typescript
async function generate() {
  setLoading(true);
  setError(null);
  setBullets(null);

  try {
    const filtered = filterEntries(entries, timeframe, selectedTags);
    const trimmedPrompt = userPrompt.trim();
    const response = await fetch("/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: filtered,
        groupBy,
        ...(trimmedPrompt && { userPrompt: trimmedPrompt }),
        user_context: serializeContext(readSettings()),
      }),
    });
    // ...rest unchanged
```

`user_context` is always present in the body (either an object or `null`); we don't conditionally omit it the way `userPrompt` is conditionally included, because the backend's contract is clearer when a documented optional field is sent explicitly as `null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BragDoc.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BragDoc.tsx frontend/src/components/BragDoc.test.tsx
git commit -m "Wire BragDoc to send user_context"
```

---

## Task 8: Playwright end-to-end

**Files:**
- Create: `frontend/e2e/settings-coach.spec.ts`

- [ ] **Step 1: Write the spec**

Create `frontend/e2e/settings-coach.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("changing coaching style is sent on the next coach turn", async ({
  page,
}) => {
  let lastTurnBody: Record<string, unknown> | null = null;
  await page.route("**/api/coach/turn", async (route) => {
    lastTurnBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Hi there", notes: [] }),
    });
  });

  // Change style in Settings.
  await page.click('button:has-text("Settings")');
  await page.click('button[aria-label="The Hype Woman"]');

  // Save an entry from the Journal tab.
  await page.click('button:has-text("Journal")');
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "Drove the Q2 migration"
  );
  await page.click('button:has-text("Save")');

  // Open the coach.
  await page.click('button:has-text("Talk it through with the coach")');

  await expect.poll(() => lastTurnBody?.coaching_style).toBe("hype-woman");
  await expect.poll(() => lastTurnBody?.user_context).toBeNull();
});

test("user_context is sent to the coach when set in Settings", async ({
  page,
}) => {
  let lastTurnBody: Record<string, unknown> | null = null;
  await page.route("**/api/coach/turn", async (route) => {
    lastTurnBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Hi", notes: [] }),
    });
  });

  await page.click('button:has-text("Settings")');
  await page.fill(
    'input[aria-label="Headline"]',
    "Senior backend engineer at a fintech"
  );
  await page.fill(
    'textarea[aria-label="What else should the coach know?"]',
    "Working towards staff promotion"
  );
  // Blur the textarea by clicking elsewhere.
  await page.click("body");

  await page.click('button:has-text("Journal")');
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "Drove the Q2 migration"
  );
  await page.click('button:has-text("Save")');
  await page.click('button:has-text("Talk it through with the coach")');

  await expect
    .poll(() => (lastTurnBody?.user_context as Record<string, unknown>)?.headline)
    .toBe("Senior backend engineer at a fintech");
});

test("coaching style choice persists across reloads", async ({ page }) => {
  await page.click('button:has-text("Settings")');
  await page.click('button[aria-label="The Bold Coach"]');
  await page.reload();
  await page.click('button:has-text("Settings")');
  const radio = page.locator('button[aria-label="The Bold Coach"]');
  await expect(radio).toHaveAttribute("aria-checked", "true");
});
```

If the existing Settings tab navigation doesn't use `button:has-text("Settings")`, adjust the selectors to match. Check `frontend/e2e/coach.spec.ts` and the App component for the right pattern.

- [ ] **Step 2: Run the spec**

Run: `npx playwright test settings-coach.spec.ts`
Expected: PASS — all three tests green.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/settings-coach.spec.ts
git commit -m "Add Playwright coverage for coaching style and user context"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: PASS — all unit tests green.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Full Playwright suite**

Run: `npx playwright test`
Expected: all e2e tests green (including the new spec).

- [ ] **Step 6: Manual smoke test**

Start the dev server (`npm run dev`) and a Python backend if available, then:

- Open Settings — confirm the new cards appear above Categories. Click each style and reload; the choice persists.
- Type into Headline + notes, blur away from each, reload; the values persist.
- Save a journal entry, click "Talk it through with the coach", and check the Network tab: the request to `/api/coach/turn` should contain `coaching_style` and `user_context` in its body.
- Generate a brag doc; check the Network tab: the request to `/api/generate-brag-doc` should contain `user_context`.

(Until the backend changes land, the chosen style and context will be ignored on the wire — but the request bodies will be correct.)
