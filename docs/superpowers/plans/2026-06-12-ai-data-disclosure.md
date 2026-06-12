# AI Data Disclosure + Consent Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface an in-app disclosure that entry text is sent to Anthropic when using AI features (Coach + Brag Doc), backed by a user-controlled acknowledgement in a new Settings → Privacy tab and a one-time consent gate.

**Architecture:** A persisted boolean `aiConsent` lives on the per-user `settings` row (Supabase). `App` is the single source of truth for the value: it loads it on mount, exposes a `requireAiConsent(run)` guard, and owns an `AiConsentGate` modal. The two AI trigger points — "Coach me" (EntryList) and "Generate" (BragDoc) — route their action through the guard. A controlled `PrivacyCard` in the Settings drawer lets users toggle the acknowledgement directly.

**Tech Stack:** Next.js (App Router) + TypeScript, React, Tailwind, Vitest + React Testing Library, Supabase (Postgres). All paths below are relative to `frontend/` unless noted.

---

## File Structure

- **Modify** `frontend/src/lib/types.ts` — add `aiConsent` to `UserSettings` + default.
- **Modify** `frontend/src/lib/settings.ts` — read/write the `ai_consent` column.
- **Modify** `frontend/src/lib/settings.test.ts` — cover `aiConsent` round-trip; fix existing expectations.
- **Create** `supabase/migrations/0004_add_ai_consent.sql` — add the column (repo root, not `frontend/`).
- **Create** `frontend/src/components/AiConsentGate.tsx` — the consent modal.
- **Create** `frontend/src/components/AiConsentGate.test.tsx` — modal tests.
- **Modify** `frontend/src/components/Settings.tsx` — add `PrivacyCard` (controlled).
- **Modify** `frontend/src/components/Settings.test.tsx` — `PrivacyCard` tests.
- **Modify** `frontend/src/components/SettingsDrawer.tsx` — Privacy tab + pass-through props.
- **Modify** `frontend/src/components/SettingsDrawer.test.tsx` — Privacy tab test + helper props.
- **Modify** `frontend/src/components/EntryList.tsx` — route "Coach me" through guard.
- **Modify** `frontend/src/components/EntryList.test.tsx` — gate test + helper prop.
- **Modify** `frontend/src/components/BragDoc.tsx` — route "Generate" through guard.
- **Modify** `frontend/src/components/BragDoc.test.tsx` — gate test + helper prop.
- **Modify** `frontend/src/components/App.tsx` — load consent, guard, gate, wire props.

Run all commands from `frontend/`. Test runner: `npm test -- <path>` (Vitest, run-once).

---

## Task 1: Add `aiConsent` to the settings data layer

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/settings.ts`
- Test: `frontend/src/lib/settings.test.ts`

- [ ] **Step 1: Write the failing test**

In `frontend/src/lib/settings.test.ts`, add this test inside the `describe("settings", ...)` block:

```ts
it("readSettings maps ai_consent into aiConsent", async () => {
  client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
  client.single.mockReturnValueOnce(Promise.resolve({
    data: {
      user_id: "u1",
      coaching_style: "trusted-mentor",
      custom_tags: [],
      user_context: null,
      ai_consent: true,
    },
    error: null,
  }));
  const { readSettings } = await import("./settings");
  const result = await readSettings();
  expect(result.aiConsent).toBe(true);
});

it("writeSettings includes ai_consent in the upserted payload", async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  client.single.mockReturnValueOnce(Promise.resolve({
    data: {
      user_id: "u1",
      coaching_style: "trusted-mentor",
      custom_tags: [],
      user_context: null,
      ai_consent: false,
    },
    error: null,
  }));
  client.upsert.mockReturnValueOnce(Promise.resolve({ error: null }));
  const { writeSettings } = await import("./settings");
  await writeSettings({ aiConsent: true });
  expect(client.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ ai_consent: true }),
    { onConflict: "user_id" }
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/settings.test.ts`
Expected: FAIL — `result.aiConsent` is `undefined`; `ai_consent` not in the upsert payload.

- [ ] **Step 3: Add `aiConsent` to the types**

In `frontend/src/lib/types.ts`, update the `UserSettings` interface:

```ts
export interface UserSettings {
  coachingStyle: CoachingStyle;
  contextHeadline: string;
  contextNotes: string;
  aiConsent: boolean;
}
```

And update `DEFAULT_USER_SETTINGS`:

```ts
export const DEFAULT_USER_SETTINGS: UserSettings = {
  coachingStyle: "trusted-mentor",
  contextHeadline: "",
  contextNotes: "",
  aiConsent: false,
};
```

- [ ] **Step 4: Read and write the column in `settings.ts`**

In `frontend/src/lib/settings.ts`, add the field to `SettingsRow`:

```ts
interface SettingsRow {
  user_id: string;
  coaching_style: CoachingStyle;
  custom_tags: string[];
  user_context: { headline: string; notes: string } | null;
  ai_consent: boolean;
}
```

Update `rowToSettings`:

```ts
function rowToSettings(row: SettingsRow): UserSettings {
  return {
    coachingStyle: row.coaching_style,
    contextHeadline: row.user_context?.headline ?? "",
    contextNotes: row.user_context?.notes ?? "",
    aiConsent: row.ai_consent ?? false,
  };
}
```

Update the `payload` in `writeSettings` to include the column:

```ts
const payload = {
  user_id: userId,
  coaching_style: next.coachingStyle,
  user_context: {
    headline: next.contextHeadline,
    notes: next.contextNotes,
  },
  ai_consent: next.aiConsent,
  updated_at: new Date().toISOString(),
};
```

- [ ] **Step 5: Fix the two existing `readSettings` expectations**

The existing tests `"readSettings returns mapped fields from the settings row"` and `"readSettings returns defaults when no row exists"` assert with `toEqual({...})` objects that now lack `aiConsent`. Update both expected objects to include `aiConsent: false`. For the "mapped fields" test, also add `ai_consent: false` to its mock row `data`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/lib/settings.test.ts`
Expected: PASS (all settings tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/settings.ts src/lib/settings.test.ts
git commit -m "feat: persist aiConsent on user settings"
```

---

## Task 2: Supabase migration for the `ai_consent` column

**Files:**
- Create: `supabase/migrations/0004_add_ai_consent.sql` (repo root)

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0004_add_ai_consent.sql` (note: repo root `supabase/`, sibling of `frontend/`):

```sql
-- Per-user acknowledgement that entry text is sent to Anthropic for AI features.
alter table public.settings
  add column ai_consent boolean not null default false;
```

- [ ] **Step 2: Verify the SQL is well-formed**

This is a schema change with no automated test. Confirm the file matches the existing migration style in `supabase/migrations/0001_initial_schema.sql` (lowercase SQL, `public.` schema prefix). Apply it to your Supabase project with your normal workflow (e.g. `supabase db push`) before manually testing the gate end-to-end.

- [ ] **Step 3: Commit**

```bash
git add ../supabase/migrations/0004_add_ai_consent.sql
git commit -m "feat: add ai_consent column to settings table"
```

---

## Task 3: `AiConsentGate` modal component

**Files:**
- Create: `frontend/src/components/AiConsentGate.tsx`
- Test: `frontend/src/components/AiConsentGate.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/AiConsentGate.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiConsentGate } from "./AiConsentGate";

describe("AiConsentGate", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <AiConsentGate open={false} onAccept={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Anthropic disclosure when open", () => {
    render(<AiConsentGate open={true} onAccept={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/sent to Anthropic/i)).toBeInTheDocument();
  });

  it("calls onAccept when continue is clicked", () => {
    const onAccept = vi.fn();
    render(<AiConsentGate open={true} onAccept={onAccept} onCancel={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /i understand, continue/i })
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<AiConsentGate open={true} onAccept={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/AiConsentGate.test.tsx`
Expected: FAIL — `Cannot find module './AiConsentGate'`.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/AiConsentGate.tsx` (modal pattern mirrors `AboutModal.tsx`; overlay uses a distinct aria-label so it does not collide with the Cancel button in queries):

```tsx
"use client";

import { useEffect } from "react";

interface AiConsentGateProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function AiConsentGate({ open, onAccept, onCancel }: AiConsentGateProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI data disclosure"
    >
      <button
        type="button"
        aria-label="Dismiss dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-black/30 border-none cursor-default"
        style={{ animation: "fadeIn 0.2s ease both" }}
      />
      <aside
        className="relative bg-white rounded-lg shadow-xl max-w-[480px] w-full"
        style={{ animation: "fadeIn 0.25s ease both" }}
      >
        <div className="px-8 py-10">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-4">
            Before you use AI features
          </h2>
          <p
            className="font-body text-base text-[var(--color-neutral-700)] mb-4"
            style={{ lineHeight: 1.7 }}
          >
            To coach you and generate your Brag Doc, the text of your entries is
            sent to Anthropic, which powers the AI. Continue only if you&apos;re
            happy for this text to be sent.
          </p>
          <p
            className="font-body text-sm text-[var(--color-neutral-500)] mb-8"
            style={{ lineHeight: 1.6 }}
          >
            You can change this anytime in Settings &rarr; Privacy.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="font-body text-sm font-medium text-[var(--color-neutral-700)] border border-[var(--color-neutral-300)] rounded-md px-5 py-2.5 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-5 py-2.5 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
            >
              I understand, continue
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/AiConsentGate.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AiConsentGate.tsx src/components/AiConsentGate.test.tsx
git commit -m "feat: add AiConsentGate modal"
```

---

## Task 4: `PrivacyCard` (controlled) in the Settings drawer content

**Files:**
- Modify: `frontend/src/components/Settings.tsx`
- Test: `frontend/src/components/Settings.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/Settings.test.tsx`, add `PrivacyCard` to the import from `./Settings` and append this block:

```tsx
describe("PrivacyCard", () => {
  it("renders the disclosure about sending data to Anthropic", () => {
    render(<PrivacyCard value={false} onChange={vi.fn()} />);
    expect(screen.getByText(/sent to Anthropic/i)).toBeInTheDocument();
  });

  it("reflects the current value in the checkbox", () => {
    render(<PrivacyCard value={true} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onChange with the new value when toggled", () => {
    const onChange = vi.fn();
    render(<PrivacyCard value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

Ensure `fireEvent` is imported from `@testing-library/react` in this file (add it to the existing import if missing).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/Settings.test.tsx`
Expected: FAIL — `PrivacyCard` is not exported from `./Settings`.

- [ ] **Step 3: Implement `PrivacyCard`**

In `frontend/src/components/Settings.tsx`, add this exported component (it is controlled — no settings I/O of its own; the section styling matches the existing cards like `CoachingStyleCard`):

```tsx
interface PrivacyCardProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function PrivacyCard({ value, onChange }: PrivacyCardProps) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-display text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        AI &amp; your data
      </h3>
      <p
        className="font-body text-base text-[var(--color-neutral-600)] mb-6"
        style={{ lineHeight: 1.6 }}
      >
        When you use Coach or generate a Brag Doc, the text of your entries is
        sent to Anthropic, which powers the AI. Nothing is sent until you turn
        on an AI feature.
      </p>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1"
        />
        <span
          className="font-body text-base text-[var(--color-neutral-700)]"
          style={{ lineHeight: 1.6 }}
        >
          I understand my entry text is sent to Anthropic when I use these
          features. Unticking this means you&apos;ll be asked again next time.
        </span>
      </label>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings.tsx src/components/Settings.test.tsx
git commit -m "feat: add PrivacyCard with AI data acknowledgement"
```

---

## Task 5: Add the Privacy tab to `SettingsDrawer`

**Files:**
- Modify: `frontend/src/components/SettingsDrawer.tsx`
- Test: `frontend/src/components/SettingsDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/SettingsDrawer.test.tsx`, first add the two new required props to the `renderDrawer` helper's `props` object:

```tsx
    onClearData: vi.fn(),
    aiConsent: false,
    onAiConsentChange: vi.fn(),
    ...overrides,
```

Then add this test inside the existing `describe`:

```tsx
it("shows the Privacy tab and toggling consent calls onAiConsentChange", () => {
  const onAiConsentChange = vi.fn();
  const { props } = renderDrawer(true, { onAiConsentChange });
  fireEvent.click(screen.getByRole("tab", { name: "Privacy" }));
  expect(screen.getByText(/sent to Anthropic/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(props.onAiConsentChange).toHaveBeenCalledWith(true);
});
```

Ensure `fireEvent` and `screen` are imported from `@testing-library/react` in this file (add if missing).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/SettingsDrawer.test.tsx`
Expected: FAIL — no "Privacy" tab exists; TS also flags the unknown props until Step 3.

- [ ] **Step 3: Add the Privacy section, props, and rendering**

In `frontend/src/components/SettingsDrawer.tsx`:

Add `PrivacyCard` to the import from `./Settings`:

```tsx
import {
  AccountCard,
  ContextCard,
  CoachingStyleCard,
  CategoriesCard,
  DataCard,
  PrivacyCard,
} from "./Settings";
```

Extend the `Section` type and `SECTIONS` list:

```tsx
type Section = "you" | "coach" | "data" | "privacy";
```

```tsx
const SECTIONS: { key: Section; label: string }[] = [
  { key: "you", label: "You" },
  { key: "coach", label: "Coach" },
  { key: "data", label: "Data" },
  { key: "privacy", label: "Privacy" },
];
```

Add the two props to `SettingsDrawerProps`:

```tsx
interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  tags: TagDef[];
  onAddTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
  onClearData: () => void;
  aiConsent: boolean;
  onAiConsentChange: (value: boolean) => void;
}
```

Destructure them in the component signature (add after `onClearData`):

```tsx
  onClearData,
  aiConsent,
  onAiConsentChange,
}: SettingsDrawerProps) {
```

Render the card in the content area, alongside the other `section === ...` blocks (just before the trailing `<AccountCard />`):

```tsx
            {section === "privacy" && (
              <PrivacyCard value={aiConsent} onChange={onAiConsentChange} />
            )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/SettingsDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsDrawer.tsx src/components/SettingsDrawer.test.tsx
git commit -m "feat: add Privacy tab to settings drawer"
```

---

## Task 6: Route "Coach me" through a consent guard in `EntryList`

**Files:**
- Modify: `frontend/src/components/EntryList.tsx`
- Test: `frontend/src/components/EntryList.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/EntryList.test.tsx`, add `onRequireConsent` to the `renderList` helper's `props` object with a default that runs immediately (so existing Coach tests keep working):

```tsx
    onCoachDismiss: vi.fn(),
    onRequireConsent: (run: () => void) => run(),
    ...overrides,
```

Then add this test:

```tsx
it("routes Coach me through onRequireConsent and does not open the panel until it runs", () => {
  const onRequireConsent = vi.fn();
  renderList({ onRequireConsent });
  fireEvent.click(screen.getAllByRole("button", { name: "Coach me" })[0]);
  expect(onRequireConsent).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("mock-coach-panel")).not.toBeInTheDocument();
  onRequireConsent.mock.calls[0][0]();
  expect(screen.getByTestId("mock-coach-panel")).toBeInTheDocument();
});
```

Ensure `fireEvent` is imported from `@testing-library/react` in this file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/EntryList.test.tsx`
Expected: FAIL — `onRequireConsent` is not used by the component, so the panel opens immediately and `onRequireConsent` is never called.

- [ ] **Step 3: Add the prop and route the click**

In `frontend/src/components/EntryList.tsx`, add to the props interface (next to `onCoachDismiss`):

```tsx
  onRequireConsent: (run: () => void) => void;
```

Destructure it in the component signature (add after `onCoachDismiss`):

```tsx
  onCoachDismiss,
  onRequireConsent,
}: EntryListProps) {
```

Change the "Coach me" button `onClick` to route through the guard:

```tsx
                    onClick={() =>
                      onRequireConsent(() => setCoachOpenId(entry.id))
                    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/EntryList.test.tsx`
Expected: PASS (new test and existing Coach tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryList.tsx src/components/EntryList.test.tsx
git commit -m "feat: gate Coach me behind consent guard"
```

---

## Task 7: Route "Generate" through the consent guard in `BragDoc`

**Files:**
- Modify: `frontend/src/components/BragDoc.tsx`
- Test: `frontend/src/components/BragDoc.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/BragDoc.test.tsx`, add `onRequireConsent` to the `renderBragDoc` helper's `props` object with a default that runs immediately (so existing generate tests keep working):

```tsx
    tags: TAGS,
    onRequireConsent: (run: () => void) => run(),
    ...overrides,
```

Then add this test:

```tsx
it("routes Generate through onRequireConsent instead of fetching directly", () => {
  const onRequireConsent = vi.fn();
  const fetchSpy = vi.spyOn(global, "fetch");
  renderBragDoc({ onRequireConsent });
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  expect(onRequireConsent).toHaveBeenCalledTimes(1);
  expect(fetchSpy).not.toHaveBeenCalled();
});
```

Ensure `fireEvent`, `screen`, and `vi` are imported in this file. If a default tag must be selected for the Generate button to be enabled, mirror the setup used by the existing "generate" test in this file (select a tag before clicking).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/BragDoc.test.tsx`
Expected: FAIL — `Generate` calls `generate()` directly, so `onRequireConsent` is never called.

- [ ] **Step 3: Add the prop and route the click**

In `frontend/src/components/BragDoc.tsx`, add to `BragDocProps` (next to `entries` / `tags`):

```tsx
  onRequireConsent: (run: () => void) => void;
```

Destructure it in the component signature:

```tsx
export function BragDoc({ entries, tags, onRequireConsent }: BragDocProps) {
```

Change the Generate button `onClick`:

```tsx
          onClick={() => onRequireConsent(() => void generate())}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/BragDoc.test.tsx`
Expected: PASS (new test and existing generate tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/BragDoc.tsx src/components/BragDoc.test.tsx
git commit -m "feat: gate Brag Doc generation behind consent guard"
```

---

## Task 8: Wire consent state, guard, and gate into `App`

**Files:**
- Modify: `frontend/src/components/App.tsx`
- Test: `frontend/src/components/App.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/App.test.tsx`, add a test that the gate appears when an AI action is triggered without consent. Match the file's existing mocking style; the key assertions are:

```tsx
it("shows the consent gate when Coach me is clicked without prior consent", async () => {
  // readSettings is mocked to resolve aiConsent: false (the default).
  render(<App />);
  // Wait for at least one entry to render, then click its Coach me button.
  const coachButton = (await screen.findAllByRole("button", { name: "Coach me" }))[0];
  fireEvent.click(coachButton);
  expect(
    await screen.findByRole("button", { name: /i understand, continue/i })
  ).toBeInTheDocument();
});
```

Notes for matching this file's harness:
- `App.test.tsx` already mocks `@/lib/entries`, `@/lib/tags`, and related modules. Add a mock for `@/lib/settings` so `readSettings` resolves `{ ...DEFAULT_USER_SETTINGS, aiConsent: false }` and `writeSettings` resolves. Reuse `DEFAULT_USER_SETTINGS` from `@/lib/types`.
- Ensure the mocked entries list is non-empty so a "Coach me" button renders (an entry with `coachNotes: null`).
- If the existing tests already mock `@/lib/settings`, extend that mock rather than redeclaring it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/App.test.tsx`
Expected: FAIL — no consent gate renders; clicking "Coach me" opens the panel directly.

- [ ] **Step 3: Add imports and consent state to `App`**

In `frontend/src/components/App.tsx`:

Update the React import to include `useRef`:

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
```

Add the gate and settings imports:

```tsx
import { AiConsentGate } from "./AiConsentGate";
import { readSettings, writeSettings } from "@/lib/settings";
```

Add state near the other `useState` calls in `App`:

```tsx
  const [aiConsent, setAiConsent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
```

- [ ] **Step 4: Load the persisted consent on mount**

Add a dedicated effect inside `App` (separate from the entries/tags effect):

```tsx
  useEffect(() => {
    let cancelled = false;
    readSettings().then(
      (s) => {
        if (!cancelled) setAiConsent(s.aiConsent);
      },
      () => {
        /* not signed in / no row yet — stay false */
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);
```

- [ ] **Step 5: Add the guard and gate handlers**

Add these inside `App`:

```tsx
  async function handleAiConsentChange(next: boolean) {
    setAiConsent(next);
    await writeSettings({ aiConsent: next });
  }

  const requireAiConsent = useCallback(
    (run: () => void) => {
      if (aiConsent) {
        run();
        return;
      }
      pendingActionRef.current = run;
      setGateOpen(true);
    },
    [aiConsent]
  );

  async function handleGateAccept() {
    await handleAiConsentChange(true);
    setGateOpen(false);
    const run = pendingActionRef.current;
    pendingActionRef.current = null;
    run?.();
  }

  function handleGateCancel() {
    pendingActionRef.current = null;
    setGateOpen(false);
  }
```

- [ ] **Step 6: Pass the guard and consent props through the tree**

Pass `onRequireConsent` to `EntryList` (in the journal tabpanel):

```tsx
                <EntryList
                  entries={entries}
                  tags={tags}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onCoachAccept={handleCoachAccept}
                  onCoachDismiss={handleCoachDismiss}
                  onRequireConsent={requireAiConsent}
                />
```

Pass `onRequireConsent` to `BragDoc`:

```tsx
              <BragDoc
                entries={entries}
                tags={tags}
                onRequireConsent={requireAiConsent}
              />
```

Pass the consent props to `SettingsDrawer`:

```tsx
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tags={tags}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        onRenameTag={handleRenameTag}
        onClearData={handleClearData}
        aiConsent={aiConsent}
        onAiConsentChange={handleAiConsentChange}
      />
```

Render the gate alongside the other modals (just before the closing `</div>` near `<AboutModal ... />`):

```tsx
      <AiConsentGate
        open={gateOpen}
        onAccept={handleGateAccept}
        onCancel={handleGateCancel}
      />
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- src/components/App.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/App.tsx src/components/App.test.tsx
git commit -m "feat: wire AI consent guard and gate into App"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 2: Type-check / lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 4: Manual smoke (after applying the migration from Task 2)**

1. Sign in. Open Settings → Privacy: the acknowledgement is unticked.
2. From a past entry, click "Coach me" → the consent gate appears. Click Cancel → panel does not open.
3. Click "Coach me" again → Accept → the Coach panel opens and the choice persists.
4. Reload. Click "Coach me" again → no gate (consent remembered). Go to Brag Doc → Generate → no gate.
5. Settings → Privacy → untick → confirm the gate appears again on the next AI action.

- [ ] **Step 5: Commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore: verification fixes for AI consent gate"
```

---

## Self-Review Notes

- **Spec coverage:** Data model + persistence (Task 1, 2); Privacy tab (Task 4, 5); consent gate + interception for Coach and Brag Doc (Task 3, 6, 7, 8); tests across all tasks. All spec sections covered.
- **Type consistency:** `aiConsent: boolean` (app) ↔ `ai_consent` (DB column) is mapped only in `settings.ts`. The guard prop is named `onRequireConsent` on child components and `requireAiConsent` as the App-side function consistently. `SettingsDrawer` props `aiConsent` / `onAiConsentChange` match `App`'s wiring and `PrivacyCard`'s `value` / `onChange`.
- **Out of scope (unchanged):** no written legal documents; no change to backend request/response shapes.
