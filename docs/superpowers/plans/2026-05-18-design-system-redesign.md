# Design System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark editorial theme with the light warm theme defined in `docs/superpowers/specs/DESIGN_GUIDELINES.md`, per the spec in `docs/superpowers/specs/2026-05-18-redesign-design.md`.

**Architecture:** Visual-only refresh. All theme tokens in `globals.css` are swapped (dark → light). Per-component inline `style={{}}` props migrate to Tailwind v4 utility classes that resolve against the new tokens. The custom user-tag system stays, but per-tag colors are removed entirely. Data model, API routes, and component file structure are unchanged.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, Vitest, Playwright. Fonts: Fraunces (kept), Inter (replaces Outfit), JetBrains Mono (replaces IBM Plex Mono).

---

## Working principles

This is a design migration, not new feature work. TDD-by-failing-test-first doesn't fit. Use this rhythm for every component task:

1. Read the current file to understand its structure.
2. Replace inline styles with utility classes per the spec.
3. Run the component's vitest file.
4. If a test fails on theme-coupled assertions (hex colors, font-family strings, mono uppercase labels, accent-bar elements), update the assertion to check **semantic state** instead — `aria-selected`, role, text content, or class presence. Do not delete tests. Do not stop checking that the behavior works.
5. Re-run vitest until green.
6. Commit.

Manual visual verification happens once at the end (Task 13). Don't spin up the dev server between every component change — the cycle is too slow.

**Tailwind v4 class style:** the project's `globals.css` defines theme tokens in `@theme {}`. Use Tailwind utility classes like `bg-white`, `text-neutral-700`, `p-6`, `rounded-lg`, `shadow-sm`. For tokens not directly exposed as utilities (e.g. `--color-primary-500`), use arbitrary values: `bg-[var(--color-primary-500)]`. Prefer named utilities over arbitrary values when both work.

---

## File structure

**Modified:**
- `frontend/src/app/globals.css` — full theme token swap, font @font-face swaps, body styles, scrollbar recolor, `saveFlash` keyframe rgb tweak.
- `frontend/src/lib/tags.ts` — drop `color` field from `TagDef`, remove `PALETTE`, `TagColor`, `nextUnusedColor`, `tagColorFromHex`, `tagColorFor`. Simplify `DEFAULT_TAGS`.
- `frontend/src/components/App.tsx` — `handleAddTag` signature (drop color param), shell layout (1200px outer / 800px inner), header (no accent bar), tab nav (sentence-case Inter), section spacing.
- `frontend/src/components/TagPicker.tsx` — uniform neutral pill style, drop `tagColorFromHex` import.
- `frontend/src/components/EntryForm.tsx` — hero Fraunces prompt, ghost refresh button, light textarea, primary save button.
- `frontend/src/components/EntryList.tsx` — card pattern, empty-state copy, restyled reframed toggle.
- `frontend/src/components/ReframeView.tsx` — guide's AI Coach Messages pattern.
- `frontend/src/components/CoachMessage.tsx` — coach surface pattern, drop mono uppercase role label.
- `frontend/src/components/CoachNotePills.tsx` — primary-tinted small pills.
- `frontend/src/components/CoachPanel.tsx` — coach surface pattern.
- `frontend/src/components/BragDoc.tsx` — filter pill group, Fraunces output headings, copy success toast.
- `frontend/src/components/Settings.tsx` — restyle CoachingStyleCard, ContextCard, CategoriesCard (remove color picker), DataCard (danger button style).

**Tests modified (theme-coupled assertions):**
- `frontend/src/components/TagPicker.test.tsx`
- `frontend/src/components/Settings.test.tsx`
- Others as needed — discover by running tests.

**Not affected:**
- `frontend/src/lib/entries.ts`, `prompts.ts`, `dates.ts`, `types.ts`, `settings.ts` (no visual concerns; the `TagDef` change in `tags.ts` propagates by type).
- `frontend/src/app/api/*` (API routes).
- `frontend/src/app/layout.tsx` (font loading already lives in `globals.css`).
- `frontend/e2e/*.spec.ts` Playwright tests should keep passing since flows don't change; they get a smoke pass at the end.

---

## Task 1: Replace theme tokens in `globals.css`

**Files:**
- Modify: `frontend/src/app/globals.css`

Replace the entire file with the new theme. The current `@theme {}` block defines dark tokens; this swaps it wholesale.

- [ ] **Step 1: Read current `globals.css`**

Run: `cat frontend/src/app/globals.css`
Expected: see current `@font-face` blocks for Fraunces/Outfit/IBM Plex Mono, `@theme {}` with dark tokens, body styles with `::before`/`::after` overlays, scrollbar, keyframes.

- [ ] **Step 2: Replace the file**

Write `frontend/src/app/globals.css`:

```css
@import "tailwindcss";

@layer base {
  @font-face {
    font-family: 'Fraunces';
    font-style: normal;
    font-weight: 300 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/fraunces/v33/6NUg8FyLNQOQZAnv9ZwNjucMHVm5.woff2) format('woff2');
  }

  @font-face {
    font-family: 'Fraunces';
    font-style: italic;
    font-weight: 300 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/fraunces/v33/6NUi8FyLNQOQZAnv9ZwNjusT6sME.woff2) format('woff2');
  }

  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 300 700;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.woff2) format('woff2');
  }

  @font-face {
    font-family: 'JetBrains Mono';
    font-style: normal;
    font-weight: 400 600;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff2) format('woff2');
  }
}

@theme {
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'JetBrains Mono', Consolas, monospace;

  --color-primary-50: #fdf4f0;
  --color-primary-100: #fae8df;
  --color-primary-200: #f4cdb9;
  --color-primary-300: #eeab8c;
  --color-primary-400: #e6825f;
  --color-primary-500: #d96440;
  --color-primary-600: #c24e2f;
  --color-primary-700: #a03d27;
  --color-primary-800: #843526;
  --color-primary-900: #6e2f23;

  --color-neutral-0: #ffffff;
  --color-neutral-50: #fafaf9;
  --color-neutral-100: #f5f5f4;
  --color-neutral-200: #e7e5e4;
  --color-neutral-300: #d6d3d1;
  --color-neutral-400: #a8a29e;
  --color-neutral-500: #78716c;
  --color-neutral-600: #57534e;
  --color-neutral-700: #44403c;
  --color-neutral-800: #292524;
  --color-neutral-900: #1c1917;

  --color-success-50: #f0fdf4;
  --color-success-500: #16a34a;
  --color-warning-50: #fffbeb;
  --color-warning-500: #f59e0b;
  --color-error-50: #fef2f2;
  --color-error-500: #dc2626;
  --color-info-50: #eff6ff;
  --color-info-500: #3b82f6;

  --spacing-0: 0;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-10: 2.5rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;
  --spacing-20: 5rem;
  --spacing-24: 6rem;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px 0 rgba(28, 25, 23, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(28, 25, 23, 0.08), 0 2px 4px -2px rgba(28, 25, 23, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(28, 25, 23, 0.08), 0 4px 6px -4px rgba(28, 25, 23, 0.04);
  --shadow-xl: 0 20px 25px -5px rgba(28, 25, 23, 0.08), 0 8px 10px -6px rgba(28, 25, 23, 0.04);

  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}

@layer base {
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--font-body);
    background: var(--color-neutral-0);
    color: var(--color-neutral-600);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--color-neutral-200); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--color-neutral-400); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes saveFlash {
  0% { box-shadow: 0 0 0 0 rgba(217, 100, 64, 0.5); }
  50% { box-shadow: 0 0 20px 4px rgba(217, 100, 64, 0.3); }
  100% { box-shadow: 0 0 0 0 rgba(217, 100, 64, 0); }
}

@keyframes saveCheck {
  0% { transform: scale(0.8); opacity: 0; }
  40% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes reframeReveal {
  0% { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

.animate-in {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.animate-delay-1 { animation-delay: 0.06s; }
.animate-delay-2 { animation-delay: 0.12s; }
.animate-delay-4 { animation-delay: 0.24s; }
```

Note: the `body::before` (noise) and `body::after` (radial bloom) rules are gone. The `saveFlash` rgba values are repointed from `212, 134, 60` (old terracotta) to `217, 100, 64` (new primary-500).

- [ ] **Step 3: Verify the file compiles with the dev server**

Run: `cd frontend && npm run build`
Expected: build succeeds. Components themselves will look broken (still wired to dark tokens like `--color-base` etc.) but tokens-only compile should pass. If build fails for missing tokens, fix the offending reference in the offending component as part of that component's task — don't add back the old token names.

If you see TypeScript errors unrelated to css, ignore them for this task — they'll be addressed in Task 2.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "design: swap globals.css to light warm theme tokens"
```

---

## Task 2: Drop `color` from `TagDef` and remove color helpers

**Files:**
- Modify: `frontend/src/lib/tags.ts`

Tag colors are gone. The type, defaults, palette, and helper functions all simplify.

- [ ] **Step 1: Rewrite `frontend/src/lib/tags.ts`**

```typescript
export interface TagDef {
  name: string;
}

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership" },
  { name: "technical" },
  { name: "collaboration" },
  { name: "problem-solving" },
  { name: "communication" },
  { name: "mentoring" },
];

const STORAGE_KEY = "confidence-journal:tags";

function read(): TagDef[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return (parsed as Array<{ name: string }>).map((t) => ({ name: t.name }));
  } catch {
    return null;
  }
}

function write(tags: TagDef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

export function getTags(): TagDef[] {
  const stored = read();
  if (stored === null) {
    write(DEFAULT_TAGS);
    return [...DEFAULT_TAGS];
  }
  return stored;
}

export function saveTags(tags: TagDef[]): void {
  write(tags);
}

export function isDuplicateName(
  tags: TagDef[],
  name: string,
  excludeName?: string
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return tags.some(
    (t) => t.name !== excludeName && t.name.toLowerCase() === normalized
  );
}
```

Note: existing stored tag JSON in localStorage may have a `color` field — the new `read()` strips it on load.

- [ ] **Step 2: Run vitest to find compile errors**

Run: `cd frontend && npm test`
Expected: TypeScript errors in `App.tsx`, `TagPicker.tsx`, `Settings.tsx`, and `TagPicker.test.tsx` for unknown imports (`PALETTE`, `nextUnusedColor`, `tagColorFromHex`, `tagColorFor`, `TagColor`) and `color` property usage. These will be fixed in their respective tasks.

Do not fix them yet. Skip ahead.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/tags.ts
git commit -m "design: drop color from TagDef and remove tag color helpers"
```

---

## Task 3: Restyle `App.tsx` (shell, header, tab nav)

**Files:**
- Modify: `frontend/src/components/App.tsx`

This restores compilation (App calls `handleAddTag(name, color)` — drop the color param) and applies the new layout shell.

- [ ] **Step 1: Read current `App.tsx`**

Run: `cat frontend/src/components/App.tsx`
Expected: see the current 760px container, header with accent bar, mono uppercase tabs.

- [ ] **Step 2: Update `handleAddTag` signature and remove the call site's color argument**

In `App.tsx`:

```typescript
function handleAddTag(name: string) {
  const next = [...tags, { name }];
  saveTags(next);
  setTags(next);
}
```

The Settings `onAddTag` prop type will be updated in Task 12 to match.

- [ ] **Step 3: Rewrite the JSX return block**

Replace the entire `return (…)` block:

```tsx
return (
  <div className="min-h-screen relative" style={{ zIndex: 1 }}>
    <div className="max-w-[1200px] mx-auto">
      <header
        className="animate-in flex justify-between items-center px-12 pt-12 pb-6 border-b border-[var(--color-neutral-200)]"
      >
        <div className="font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-neutral-800)]">
          Confidence
        </div>
        <span className="font-[var(--font-body)] text-xs text-[var(--color-neutral-500)]">
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          })}
        </span>
      </header>

      <nav
        role="tablist"
        className="animate-in animate-delay-1 flex gap-8 px-12 pt-6"
      >
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              id={`tab-${key}`}
              role="tab"
              aria-selected={active}
              aria-controls={`tabpanel-${key}`}
              onClick={() => setTab(key)}
              className={[
                "font-[var(--font-body)] text-sm font-medium pb-3 -mb-px border-b-2 transition-colors cursor-pointer",
                active
                  ? "text-[var(--color-neutral-800)] border-[var(--color-primary-500)]"
                  : "text-[var(--color-neutral-500)] border-transparent hover:text-[var(--color-neutral-700)]",
              ].join(" ")}
              style={{ transition: "var(--transition-fast)" }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <main className="px-12 pb-20">
        {tab === "journal" && (
          <div
            role="tabpanel"
            id="tabpanel-journal"
            aria-labelledby="tab-journal"
            className="max-w-[800px] mx-auto"
          >
            <div className="animate-in animate-delay-2">
              <EntryForm
                prompt={prompt}
                availableTags={tags}
                onSave={handleSave}
                onRefreshPrompt={handleRefreshPrompt}
              />
            </div>

            <div className="mt-16 animate-in animate-delay-4">
              <div className="flex items-baseline gap-3 mb-6">
                <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-800)]">
                  Past entries
                </h2>
                {entries.length > 0 && (
                  <span className="font-[var(--font-body)] text-sm text-[var(--color-neutral-500)]">
                    · {entries.length}
                  </span>
                )}
              </div>
              <EntryList
                entries={entries}
                tags={tags}
                onEditEntry={handleEditEntry}
                onDeleteEntry={handleDeleteEntry}
                onCoachAccept={handleCoachAccept}
                onCoachDismiss={handleCoachDismiss}
              />
            </div>
          </div>
        )}

        {tab === "bragdoc" && (
          <div
            role="tabpanel"
            id="tabpanel-bragdoc"
            aria-labelledby="tab-bragdoc"
            className="animate-in animate-delay-2"
          >
            <BragDoc entries={entries} tags={tags} />
          </div>
        )}

        {tab === "settings" && (
          <div
            role="tabpanel"
            id="tabpanel-settings"
            aria-labelledby="tab-settings"
            className="max-w-[800px] mx-auto animate-in animate-delay-2"
          >
            <Settings
              tags={tags}
              onAddTag={handleAddTag}
              onDeleteTag={handleDeleteTag}
              onRenameTag={handleRenameTag}
              onClearData={handleClearData}
            />
          </div>
        )}
      </main>
    </div>
  </div>
);
```

Removed: the orange vertical accent bar before "Confidence", the mono uppercase tab styling, the entry count chip (replaced with inline metadata "· N").

- [ ] **Step 4: Run App tests**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: tests should mostly pass. If a test asserts on the accent bar element, the entry-count chip styling, or mono tab labels, update it to check semantic state (e.g., `aria-selected` for active tab, presence of "Past entries" heading text). Do not add back removed visual elements.

Common updates likely needed:
- Any `toBeInTheDocument()` queries on a vertical accent bar div → remove the assertion.
- Any `getByText("JOURNAL")` (uppercase) → use `getByRole("tab", { name: /journal/i })`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/App.tsx frontend/src/components/App.test.tsx
git commit -m "design: restyle App shell, header, and tab nav for light theme"
```

---

## Task 4: Restyle `TagPicker.tsx`

**Files:**
- Modify: `frontend/src/components/TagPicker.tsx`
- Modify: `frontend/src/components/TagPicker.test.tsx`

- [ ] **Step 1: Rewrite `TagPicker.tsx`**

```tsx
"use client";

import type { TagDef } from "@/lib/tags";

interface TagPickerProps {
  tags: TagDef[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ tags, selected, onChange }: TagPickerProps) {
  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((t) => t !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selected.includes(tag.name);
        return (
          <button
            key={tag.name}
            type="button"
            onClick={() => toggle(tag.name)}
            aria-pressed={isSelected}
            className={[
              "font-[var(--font-body)] text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition-colors",
              isSelected
                ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]",
            ].join(" ")}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
```

Note: drop the `tagColorFromHex` import. Add `aria-pressed` for accessible selection state.

- [ ] **Step 2: Update `TagPicker.test.tsx`**

Replace the file:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPicker } from "./TagPicker";
import type { TagDef } from "@/lib/tags";

const TAGS: TagDef[] = [
  { name: "leadership" },
  { name: "technical" },
  { name: "collaboration" },
  { name: "problem-solving" },
  { name: "communication" },
  { name: "mentoring" },
];

describe("TagPicker", () => {
  it("renders all tags from the provided list", () => {
    render(<TagPicker tags={TAGS} selected={[]} onChange={() => {}} />);
    TAGS.forEach((t) => {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    });
  });

  it("renders nothing when the tags list is empty", () => {
    const { container } = render(
      <TagPicker tags={[]} selected={[]} onChange={() => {}} />
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("toggles a tag on click", async () => {
    const onChange = vi.fn();
    render(<TagPicker tags={TAGS} selected={[]} onChange={onChange} />);
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith(["leadership"]);
  });

  it("removes a tag when already selected", async () => {
    const onChange = vi.fn();
    render(
      <TagPicker tags={TAGS} selected={["leadership"]} onChange={onChange} />
    );
    await userEvent.click(screen.getByText("leadership"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("marks selected tags with aria-pressed", () => {
    render(
      <TagPicker tags={TAGS} selected={["technical"]} onChange={() => {}} />
    );
    expect(screen.getByText("technical").getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByText("leadership").getAttribute("aria-pressed")).toBe(
      "false"
    );
  });
});
```

The two tests that asserted on `rgb()` colors are replaced with one `aria-pressed` test. The "user-added tag with chosen color" test is dropped — colors are no longer a thing.

- [ ] **Step 3: Run TagPicker tests**

Run: `cd frontend && npx vitest run src/components/TagPicker.test.tsx`
Expected: all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TagPicker.tsx frontend/src/components/TagPicker.test.tsx
git commit -m "design: uniform neutral tag pills, drop per-tag colors"
```

---

## Task 5: Restyle `EntryForm.tsx`

**Files:**
- Modify: `frontend/src/components/EntryForm.tsx`

- [ ] **Step 1: Rewrite `EntryForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { TagPicker } from "./TagPicker";
import type { TagDef } from "@/lib/tags";

interface EntryFormProps {
  prompt: string;
  availableTags: TagDef[];
  onSave: (data: { original: string; tags: string[] }) => void;
  onRefreshPrompt?: () => void;
}

export function EntryForm({
  prompt,
  availableTags,
  onSave,
  onRefreshPrompt,
}: EntryFormProps) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="pt-12">
      <p className="font-[var(--font-display)] text-4xl font-semibold leading-tight text-[var(--color-neutral-800)] mb-4">
        {prompt}
      </p>
      {onRefreshPrompt && (
        <button
          type="button"
          onClick={onRefreshPrompt}
          aria-label="Try another prompt"
          className="font-[var(--font-body)] text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] rounded-md px-3 py-2 transition-colors cursor-pointer mb-8 -ml-3"
        >
          Try another prompt
        </button>
      )}

      <div className="flex flex-col gap-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write about your win..."
          rows={5}
          className={[
            "w-full font-[var(--font-body)] text-lg leading-relaxed rounded-md outline-none resize-none transition-colors",
            "px-5 py-4 min-h-[120px] border placeholder:text-[var(--color-neutral-400)] text-[var(--color-neutral-700)]",
            text
              ? "bg-white border-[var(--color-neutral-300)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
              : "bg-[var(--color-neutral-50)] border-[var(--color-neutral-300)] focus:bg-white focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]",
          ].join(" ")}
          style={{ lineHeight: 1.75 }}
        />
        <TagPicker tags={availableTags} selected={tags} onChange={setTags} />
        <div className="flex items-center justify-end gap-4">
          {saved && (
            <span
              className="font-[var(--font-body)] text-sm text-[var(--color-success-500)]"
              style={{ animation: "saveCheck 0.3s ease both" }}
            >
              Win logged
            </span>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            className={[
              "font-[var(--font-body)] text-sm font-semibold rounded-md px-6 py-3 transition-colors",
              text.trim()
                ? "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] cursor-pointer"
                : "bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)] cursor-not-allowed",
            ].join(" ")}
            style={{
              animation: saved ? "saveFlash 0.6s ease" : "none",
            }}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
```

Removed: the "TODAY'S PROMPT" mono label, the orange vertical accent bar before the prompt, the SVG icon refresh button with tooltip (replaced with a ghost text button), all `style={{}}` props except keyframe animation triggers and `lineHeight: 1.75` (which is more reliable than Tailwind for textarea).

Removed the `tooltipVisible` state since the refresh control is now a labeled ghost button.

- [ ] **Step 2: Run EntryForm tests**

Run: `cd frontend && npx vitest run src/components/EntryForm.test.tsx`
Expected: form submission and validation tests should pass. Tests that assert on:
- The tooltip text presence → remove (the tooltip is gone; the button label is the same string)
- The "TODAY'S PROMPT" label → remove
- The accent-bar element → remove
- The SVG icon for refresh → update to query by `aria-label="Try another prompt"`

Update assertions to keep covering: prompt text displays, refresh button calls `onRefreshPrompt`, save button disabled when empty, save flow calls `onSave` with trimmed text and selected tags.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EntryForm.tsx frontend/src/components/EntryForm.test.tsx
git commit -m "design: restyle EntryForm with hero prompt and light textarea"
```

---

## Task 6: Restyle `EntryList.tsx`

**Files:**
- Modify: `frontend/src/components/EntryList.tsx`

- [ ] **Step 1: Read current `EntryList.tsx`**

Run: `cat frontend/src/components/EntryList.tsx`
Expected: see current rendering. Note any props you may not be familiar with (`onCoachAccept`, `onCoachDismiss`, etc.); preserve all behavior.

- [ ] **Step 2: Restyle each entry to use the card pattern**

The container of each entry should become:

```tsx
<article
  className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
  style={{ transition: "var(--transition-base)" }}
>
  …
</article>
```

The header row (date + tags) should be:

```tsx
<header className="flex items-baseline justify-between gap-4 mb-3">
  <time
    dateTime={entry.date}
    className="font-[var(--font-display)] text-lg font-medium text-[var(--color-neutral-800)]"
  >
    {formatDate(entry.date)}
  </time>
  {entry.tags.length > 0 && (
    <div className="flex flex-wrap gap-2 justify-end">
      {entry.tags.map((t) => (
        <span
          key={t}
          className="font-[var(--font-body)] text-xs font-medium px-3 py-1 rounded-full bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]"
        >
          {t}
        </span>
      ))}
    </div>
  )}
</header>
```

The body text:

```tsx
<p className="font-[var(--font-body)] text-base text-[var(--color-neutral-700)]" style={{ lineHeight: 1.75 }}>
  {entry.original}
</p>
```

The "Show reframed" / "Hide reframed" toggle becomes a ghost button:

```tsx
<button
  type="button"
  onClick={…}
  className="font-[var(--font-body)] text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] rounded-md px-3 py-2 mt-3 transition-colors cursor-pointer -ml-3"
>
  {showReframed ? "Hide reframed" : "Show reframed"}
</button>
```

Empty state:

```tsx
<div className="text-center py-16">
  <p className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-800)] mb-2">
    No wins yet
  </p>
  <p className="font-[var(--font-body)] text-base text-[var(--color-neutral-500)]">
    They&apos;ll be here when you&apos;re ready.
  </p>
</div>
```

The list container:

```tsx
<div className="flex flex-col gap-6">
  …
</div>
```

Wrap all edit/delete buttons in the same ghost-button pattern as "Show reframed", except the delete button which uses `text-[var(--color-error-500)] hover:bg-[var(--color-error-50)]`.

Replace any `style={{}}` blocks throughout the component with utility classes. Preserve all event handlers and conditional rendering verbatim.

- [ ] **Step 3: Run EntryList tests**

Run: `cd frontend && npx vitest run src/components/EntryList.test.tsx`
Expected: tests for rendering entries, showing/hiding reframed, edit, delete, empty state should pass. Update theme-coupled assertions (hex colors, mono font lookups) to check semantic state or text content.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/EntryList.tsx frontend/src/components/EntryList.test.tsx
git commit -m "design: card-style entries and empty state in light theme"
```

---

## Task 7: Restyle `ReframeView.tsx`

**Files:**
- Modify: `frontend/src/components/ReframeView.tsx`

- [ ] **Step 1: Read current `ReframeView.tsx`**

Run: `cat frontend/src/components/ReframeView.tsx`

- [ ] **Step 2: Apply the guide's AI Coach Messages pattern**

The container becomes:

```tsx
<aside
  role="region"
  aria-label="Reframed version"
  className="bg-[var(--color-primary-50)] border-l-[3px] border-l-[var(--color-primary-500)] rounded-md p-5 mt-4"
  style={{ animation: "reframeReveal var(--transition-slow) both" }}
>
  <h3 className="font-[var(--font-body)] text-sm font-semibold text-[var(--color-primary-700)] mb-2">
    Reframed
  </h3>
  <p className="font-[var(--font-body)] text-base text-[var(--color-neutral-700)]" style={{ lineHeight: 1.75 }}>
    {reframed}
  </p>
  <div className="flex gap-3 mt-4">
    <button
      type="button"
      onClick={onAccept}
      className="font-[var(--font-body)] text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
    >
      Accept
    </button>
    <button
      type="button"
      onClick={onDismiss}
      className="font-[var(--font-body)] text-sm font-medium text-[var(--color-neutral-600)] rounded-md px-4 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
    >
      Dismiss
    </button>
  </div>
</aside>
```

Preserve any loading/error states with the same color tokens — error state uses `text-[var(--color-error-500)]`; loading state can use the `shimmer` keyframe on the text.

- [ ] **Step 3: Run ReframeView tests**

Run: `cd frontend && npx vitest run src/components/ReframeView.test.tsx`
Expected: tests for accept/dismiss callbacks should pass. Update any color/font assertions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ReframeView.tsx frontend/src/components/ReframeView.test.tsx
git commit -m "design: apply coach message pattern to ReframeView"
```

---

## Task 8: Restyle `CoachMessage`, `CoachNotePills`, `CoachPanel`

**Files:**
- Modify: `frontend/src/components/CoachMessage.tsx`
- Modify: `frontend/src/components/CoachNotePills.tsx`
- Modify: `frontend/src/components/CoachPanel.tsx`

All three share the coach visual language.

- [ ] **Step 1: Rewrite `CoachMessage.tsx`**

```tsx
import { CoachNotePills } from "./CoachNotePills";

interface CoachMessageProps {
  role: "coach" | "user";
  text: string;
  notes?: string[];
}

export function CoachMessage({ role, text, notes }: CoachMessageProps) {
  const isCoach = role === "coach";
  return (
    <div className={`flex flex-col gap-2 ${isCoach ? "items-start" : "items-end"}`}>
      <span className="font-[var(--font-body)] text-xs font-semibold uppercase tracking-wider text-[var(--color-neutral-500)]">
        {isCoach ? "Coach" : "You"}
      </span>
      {isCoach && notes && notes.length > 0 && <CoachNotePills notes={notes} />}
      <p
        className={
          isCoach
            ? "font-[var(--font-body)] text-base text-[var(--color-neutral-700)] bg-[var(--color-primary-50)] border-l-[3px] border-l-[var(--color-primary-500)] rounded-md px-5 py-4 max-w-[85%]"
            : "font-[var(--font-body)] text-base text-[var(--color-neutral-600)] bg-[var(--color-neutral-100)] rounded-md px-5 py-4 max-w-[85%]"
        }
        style={{ lineHeight: 1.6 }}
      >
        {text}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `CoachNotePills.tsx`**

Read it first to understand current props/markup. Then apply this pill style:

```tsx
<div className="flex flex-wrap gap-2">
  {notes.map((note, idx) => (
    <span
      key={idx}
      className="font-[var(--font-body)] text-xs font-medium px-3 py-1 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
    >
      {note}
    </span>
  ))}
</div>
```

Preserve any props/handlers from the original component.

- [ ] **Step 3: Rewrite `CoachPanel.tsx`**

Read it first. Apply the coach surface pattern to its outer container:

```tsx
<section
  className="bg-[var(--color-primary-50)] border-l-[3px] border-l-[var(--color-primary-500)] rounded-md p-5"
  style={{ animation: "reframeReveal var(--transition-slow) both" }}
>
  …
</section>
```

Inside, retitle any "Coach" heading to `text-[var(--color-primary-700)]` `font-semibold` `text-sm`. Body text uses `text-[var(--color-neutral-700)]`.

- [ ] **Step 4: Run Coach tests**

Run: `cd frontend && npx vitest run src/components/CoachMessage.test.tsx src/components/CoachNotePills.test.tsx src/components/CoachPanel.test.tsx`
Expected: tests pass. Update color/font assertions where present.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CoachMessage.tsx frontend/src/components/CoachNotePills.tsx frontend/src/components/CoachPanel.tsx frontend/src/components/CoachMessage.test.tsx frontend/src/components/CoachNotePills.test.tsx frontend/src/components/CoachPanel.test.tsx
git commit -m "design: unified coach message surface across Coach components"
```

---

## Task 9: Restyle `BragDoc.tsx`

**Files:**
- Modify: `frontend/src/components/BragDoc.tsx`

- [ ] **Step 1: Read current `BragDoc.tsx`**

Run: `cat frontend/src/components/BragDoc.tsx`

- [ ] **Step 2: Apply restyles**

Outer container takes the full 1200px (no inner column constraint, since parent already provides 1200px in App.tsx).

Date-range filter row — pill group:

```tsx
<div role="radiogroup" aria-label="Date range" className="flex gap-2 mb-8">
  {RANGES.map((range) => {
    const active = selectedRange === range.value;
    return (
      <button
        key={range.value}
        role="radio"
        aria-checked={active}
        onClick={() => setSelectedRange(range.value)}
        className={[
          "font-[var(--font-body)] text-sm font-medium rounded-full px-4 py-2 transition-colors cursor-pointer",
          active
            ? "bg-[var(--color-neutral-100)] text-[var(--color-neutral-800)]"
            : "text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-700)]",
        ].join(" ")}
      >
        {range.label}
      </button>
    );
  })}
</div>
```

Generate button — primary:

```tsx
<button
  type="button"
  onClick={onGenerate}
  disabled={isGenerating}
  className="font-[var(--font-body)] text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] disabled:bg-[var(--color-neutral-200)] disabled:text-[var(--color-neutral-400)] disabled:cursor-not-allowed transition-colors cursor-pointer"
>
  {isGenerating ? "Generating..." : "Generate"}
</button>
```

Output group headings:

```tsx
<h3 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-800)] mb-4">
  {group.tag}
</h3>
```

Output bullets:

```tsx
<ul className="flex flex-col gap-3">
  {group.points.map((point, idx) => (
    <li
      key={idx}
      className="font-[var(--font-body)] text-base text-[var(--color-neutral-700)] pl-6 relative before:absolute before:left-0 before:top-3 before:w-1 before:h-1 before:rounded-full before:bg-[var(--color-primary-500)]"
      style={{ lineHeight: 1.75 }}
    >
      {point}
    </li>
  ))}
</ul>
```

Group spacing: `mt-10` between groups (i.e. `space-y-10` on the parent).

Copy button (secondary):

```tsx
<button
  type="button"
  onClick={onCopy}
  className="font-[var(--font-body)] text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
>
  Copy to clipboard
</button>
```

Success toast (fade out via `fadeIn` keyframe + opacity transition; or just conditionally render and rely on the user's existing state machine):

```tsx
{copied && (
  <span
    role="status"
    className="font-[var(--font-body)] text-sm font-medium bg-[var(--color-success-50)] text-[var(--color-success-500)] rounded-full px-3 py-1 ml-3"
    style={{ animation: "fadeIn 0.2s ease" }}
  >
    Copied
  </span>
)}
```

Preserve all existing state, event handlers, and conditional branches verbatim.

- [ ] **Step 3: Run BragDoc tests**

Run: `cd frontend && npx vitest run src/components/BragDoc.test.tsx`
Expected: tests pass. Update theme-coupled assertions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BragDoc.tsx frontend/src/components/BragDoc.test.tsx
git commit -m "design: restyle BragDoc filter pills, output, and copy toast"
```

---

## Task 10: Restyle `Settings.tsx` — CategoriesCard (remove color picker)

**Files:**
- Modify: `frontend/src/components/Settings.tsx` (CategoriesCard sub-component only)

The biggest functional change is here: the color picker comes out, and `onAddTag` becomes `(name) => void`.

- [ ] **Step 1: Update the `SettingsProps` interface**

```typescript
interface SettingsProps {
  tags: TagDef[];
  onAddTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
  onClearData: () => void;
}
```

`onAddTag` no longer takes color.

- [ ] **Step 2: Rewrite `CategoriesCard`**

```tsx
interface CategoriesCardProps {
  tags: TagDef[];
  onAddTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
}

function CategoriesCard({
  tags,
  onAddTag,
  onDeleteTag,
  onRenameTag,
}: CategoriesCardProps) {
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");

  const trimmed = newName.trim();
  const addDisabled = trimmed.length === 0 || isDuplicateName(tags, trimmed);

  function submitNew() {
    if (addDisabled) return;
    onAddTag(trimmed);
    setNewName("");
  }

  function startEditing(tag: TagDef) {
    setEditingName(tag.name);
    setEditingDraft(tag.name);
  }

  function commitEditing() {
    if (!editingName) return;
    const nextName = editingDraft.trim();
    const isSame = nextName === editingName;
    const invalid = !nextName || isDuplicateName(tags, nextName, editingName);
    if (!isSame && !invalid) {
      onRenameTag(editingName, nextName);
    }
    setEditingName(null);
    setEditingDraft("");
  }

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Categories
      </h3>
      <p className="font-[var(--font-body)] text-base text-[var(--color-neutral-600)] mb-6" style={{ lineHeight: 1.6 }}>
        These are the tags you can apply to entries. Deleting a category removes
        it from the picker — past entries keep their tag. Renaming updates the
        tag on every entry that had it.
      </p>

      {tags.length === 0 ? (
        <p className="font-[var(--font-body)] text-sm italic text-[var(--color-neutral-500)] mb-6">
          No categories yet — add one below.
        </p>
      ) : (
        <ul className="flex flex-col mb-6">
          {tags.map((tag) => {
            const isEditing = editingName === tag.name;
            return (
              <li
                key={tag.name}
                className="flex items-center gap-3 py-3 border-b border-[var(--color-neutral-200)]"
              >
                {isEditing ? (
                  <input
                    autoFocus
                    aria-label={`Rename ${tag.name}`}
                    value={editingDraft}
                    onChange={(e) => setEditingDraft(e.target.value)}
                    onBlur={commitEditing}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEditing();
                      }
                      if (e.key === "Escape") {
                        setEditingName(null);
                        setEditingDraft("");
                      }
                    }}
                    className="flex-1 font-[var(--font-body)] text-base text-[var(--color-neutral-800)] bg-white border border-[var(--color-primary-500)] rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary-100)]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(tag)}
                    aria-label={`Rename ${tag.name}`}
                    className="flex-1 text-left font-[var(--font-body)] text-base text-[var(--color-neutral-800)] cursor-text bg-transparent border-none"
                  >
                    {tag.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteTag(tag.name)}
                  aria-label={`Delete ${tag.name}`}
                  className="font-[var(--font-body)] text-sm font-medium text-[var(--color-error-500)] hover:bg-[var(--color-error-50)] rounded-md px-3 py-2 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          aria-label="New category name"
          placeholder="New category name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNew();
            }
          }}
          className="flex-1 font-[var(--font-body)] text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
        />
        <button
          type="button"
          onClick={submitNew}
          disabled={addDisabled}
          className={[
            "font-[var(--font-body)] text-sm font-semibold rounded-md px-6 py-3 transition-colors",
            addDisabled
              ? "bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)] cursor-not-allowed"
              : "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] cursor-pointer",
          ].join(" ")}
        >
          Add
        </button>
      </div>
      {trimmed.length > 0 && isDuplicateName(tags, trimmed) && (
        <p role="alert" className="font-[var(--font-body)] text-sm text-[var(--color-error-500)] mt-3">
          A category with this name already exists.
        </p>
      )}
    </section>
  );
}
```

Removed:
- The `newColor` state and `nextUnusedColor` initializer.
- The `PALETTE` radiogroup.
- The colored dot before each tag name.
- The `import { PALETTE, nextUnusedColor }` lines at the top of the file.

The delete control is now a labeled "Delete" button instead of an "×" icon — clearer and matches the guide's button vocabulary.

- [ ] **Step 3: Verify imports**

The top of `Settings.tsx` should now read:

```typescript
import { useEffect, useState } from "react";
import { isDuplicateName, type TagDef } from "@/lib/tags";
import {
  COACHING_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
} from "@/lib/types";
import { readSettings, writeSettings } from "@/lib/settings";
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Settings.tsx
git commit -m "design: remove color picker from CategoriesCard"
```

---

## Task 11: Restyle `Settings.tsx` — remaining cards

**Files:**
- Modify: `frontend/src/components/Settings.tsx` (CoachingStyleCard, ContextCard, DataCard, top-level Settings layout)

- [ ] **Step 1: Update the top-level `Settings` component layout**

```tsx
return (
  <div className="pt-12 flex flex-col gap-12">
    <CoachingStyleCard />
    <ContextCard />
    <CategoriesCard
      tags={tags}
      onAddTag={onAddTag}
      onDeleteTag={onDeleteTag}
      onRenameTag={onRenameTag}
    />
    <DataCard
      confirming={confirming}
      onConfirm={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      onClearData={() => {
        onClearData();
        setConfirming(false);
      }}
    />
  </div>
);
```

48px gap between cards (`gap-12`).

- [ ] **Step 2: Rewrite `CoachingStyleCard`**

```tsx
function CoachingStyleCard() {
  const [style, setStyle] = useState<CoachingStyle>(
    DEFAULT_USER_SETTINGS.coachingStyle
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe load from localStorage
    setStyle(readSettings().coachingStyle);
  }, []);

  function pick(next: CoachingStyle) {
    setStyle(next);
    writeSettings({ coachingStyle: next });
  }

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Coaching style
      </h3>
      <p className="font-[var(--font-body)] text-base text-[var(--color-neutral-600)] mb-6" style={{ lineHeight: 1.6 }}>
        Pick the voice that works best for you. You can change this any time.
      </p>
      <div
        role="radiogroup"
        aria-label="Coaching style"
        className="flex flex-col gap-3"
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
              className={[
                "text-left rounded-md px-5 py-4 border transition-colors cursor-pointer",
                selected
                  ? "bg-[var(--color-primary-50)] border-[var(--color-primary-500)]"
                  : "bg-white border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-50)]",
              ].join(" ")}
            >
              <div className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-neutral-800)] mb-1">
                {option.label}
              </div>
              <div className="font-[var(--font-body)] text-sm text-[var(--color-neutral-600)]" style={{ lineHeight: 1.5 }}>
                {option.descriptor}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Rewrite `ContextCard`**

```tsx
function ContextCard() {
  const [headline, setHeadline] = useState(DEFAULT_USER_SETTINGS.contextHeadline);
  const [notes, setNotes] = useState(DEFAULT_USER_SETTINGS.contextNotes);

  useEffect(() => {
    const stored = readSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe load from localStorage
    setHeadline(stored.contextHeadline);
    setNotes(stored.contextNotes);
  }, []);

  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Your context
      </h3>
      <p className="font-[var(--font-body)] text-base text-[var(--color-neutral-600)] mb-6" style={{ lineHeight: 1.6 }}>
        Helps the coach speak to where you are. None of this leaves your browser
        unless an entry is being reframed or a brag doc is being generated.
      </p>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="font-[var(--font-body)] text-sm font-medium text-[var(--color-neutral-700)]">
            Headline
          </span>
          <input
            aria-label="Headline"
            value={headline}
            placeholder="e.g. Senior backend engineer at a fintech series-B"
            onChange={(e) => setHeadline(e.target.value)}
            onBlur={(e) => writeSettings({ contextHeadline: e.currentTarget.value })}
            className="font-[var(--font-body)] text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-[var(--font-body)] text-sm font-medium text-[var(--color-neutral-700)]">
            What else should the coach know?
          </span>
          <textarea
            aria-label="What else should the coach know?"
            value={notes}
            placeholder="What are you working towards? What's invisible in your org? What does your manager value?"
            rows={5}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => writeSettings({ contextNotes: e.currentTarget.value })}
            className="font-[var(--font-body)] text-base text-[var(--color-neutral-700)] bg-white border border-[var(--color-neutral-300)] rounded-md px-4 py-3 outline-none min-h-[120px] resize-y placeholder:text-[var(--color-neutral-400)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
            style={{ lineHeight: 1.6 }}
          />
        </label>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Rewrite `DataCard`**

```tsx
function DataCard({
  confirming,
  onConfirm,
  onCancel,
  onClearData,
}: DataCardProps) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-8">
      <h3 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-800)] mb-3">
        Data
      </h3>
      <p className="font-[var(--font-body)] text-base text-[var(--color-neutral-600)] mb-6" style={{ lineHeight: 1.6 }}>
        Your journal entries are stored locally in this browser. Entry text is
        sent to Anthropic only when you reframe an entry or generate a brag doc,
        and is not stored on our servers.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={onConfirm}
          className="font-[var(--font-body)] text-sm font-semibold bg-[var(--color-error-50)] text-[var(--color-error-500)] rounded-md px-6 py-3 hover:bg-[var(--color-error-500)] hover:text-white transition-colors cursor-pointer"
        >
          Clear all data
        </button>
      ) : (
        <div
          className="bg-[var(--color-error-50)] border border-[var(--color-error-500)] rounded-md p-5"
          style={{ animation: "fadeIn 0.2s ease both" }}
        >
          <p className="font-[var(--font-body)] text-base text-[var(--color-error-500)] mb-4">
            This will permanently delete all your journal entries.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClearData}
              className="font-[var(--font-body)] text-sm font-semibold bg-[var(--color-error-500)] text-white rounded-md px-6 py-3 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="font-[var(--font-body)] text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run Settings tests**

Run: `cd frontend && npx vitest run src/components/Settings.test.tsx`
Expected: tests pass. Tests that asserted on `PALETTE` color swatches, the `×` delete button text, or "DATA MANAGEMENT" / "CATEGORIES" mono uppercase headings will need updates:
- `getByText("×")` → `getByRole("button", { name: /delete/i })`
- `getByText("DATA MANAGEMENT")` → `getByRole("heading", { name: /data/i })`
- Color-radio-related tests → delete entirely (functionality removed)
- Any `onAddTag` mock assertion expecting two args → update to expect one arg

If any test renders `<Settings>` with a mock `onAddTag` that expects color, fix the mock signature: `onAddTag: vi.fn()` is fine; assertions become `expect(onAddTag).toHaveBeenCalledWith("focus")` (one arg).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/Settings.test.tsx
git commit -m "design: restyle CoachingStyle, Context, and Data settings cards"
```

---

## Task 12: Test sweep

**Files:**
- Modify: any remaining test files with theme-coupled assertions.

- [ ] **Step 1: Run the full vitest suite**

Run: `cd frontend && npm test`
Expected: most tests pass. Any failures are theme-coupled assertions left over (often in `App.test.tsx`, `EntryList.test.tsx`, etc.).

- [ ] **Step 2: For each failure, update the assertion**

Rules of thumb:
- `font-family: var(--font-mono)` checks → either drop or convert to checking the element exists.
- Hex color checks (e.g. `#D4863C`, `rgb(212, 134, 60)`) → drop or convert to checking `aria-*` / role / class presence.
- "JOURNAL" uppercase text → use `getByRole("tab", { name: /journal/i })`.
- Vertical accent bar div presence → drop.
- "×" delete button → `getByRole("button", { name: /delete/i })`.

Never weaken a behavioral test (e.g. "clicking save calls onSave"). Only weaken presentation assertions.

- [ ] **Step 3: Verify suite green**

Run: `cd frontend && npm test`
Expected: all vitest tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/*.test.tsx
git commit -m "design: update test assertions for new theme"
```

---

## Task 13: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors and no missing CSS token references.

- [ ] **Step 2: Run unit tests**

Run: `cd frontend && npm test`
Expected: all tests pass.

- [ ] **Step 3: Run Playwright e2e**

Run: `cd frontend && npm run test:e2e`
Expected: all e2e tests pass. Flows are unchanged — failures here usually mean a regression. If a Playwright test asserts on theme colors or font families, update it the same way as vitest assertions.

- [ ] **Step 4: Manual smoke**

Run: `cd frontend && npm run dev`
Open `http://localhost:3000` and verify:
1. Page loads on a white canvas with no noise/gradient overlays.
2. Header shows "Confidence" in Fraunces, date right-aligned in Inter `text-xs`.
3. Tab nav uses sentence-case ("Journal", "Brag Doc", "Settings") with an underline on the active tab.
4. Journal tab: prompt renders as large Fraunces hero. "Try another prompt" is a ghost text button below. Textarea is light, with primary-tinted focus ring. Tag pills are all neutral. Save button is terracotta primary.
5. Past entries: each entry in a white card with a neutral border, hover lifts shadow.
6. Save a new entry, then accept the reframe — the reframe panel appears with a primary-tinted background and left border.
7. Brag Doc tab: filter pills, Generate button works, output groups have Fraunces headings.
8. Settings tab: four white cards stacked. Categories has no color picker. Clear-data button is error-tinted.
9. No console errors.

- [ ] **Step 5: Commit if any final tweaks were needed**

If you fixed anything during manual smoke, commit those changes:

```bash
git add -p
git commit -m "design: fix issues found during manual smoke"
```

If nothing changed, no commit needed.

---

## Self-review checklist (run before handoff)

- [x] **Spec coverage:** Every section in `2026-05-18-redesign-design.md` has a task: theme tokens (T1), tag color removal (T2), shell/header/tabs (T3), TagPicker (T4), EntryForm (T5), EntryList (T6), ReframeView (T7), Coach components (T8), BragDoc (T9), Settings cards (T10–T11), tests (T12), verification (T13).
- [x] **Placeholder scan:** No "TBD", "add appropriate error handling", or vague references. Each code-changing step shows the code.
- [x] **Type consistency:** `onAddTag` signature changed from `(name, color) => void` to `(name) => void` in Tasks 3 (App.tsx) and 10–11 (Settings.tsx). `TagDef` changes from `{ name, color }` to `{ name }` in Task 2 and propagates through Tasks 4 (TagPicker) and 10–11 (Settings).
- [x] **Spec deviations called out:** Settings has four cards, not two — Task 11 covers CoachingStyle, Context, and Data; Task 10 covers Categories. The spec's Settings guidance (single column, Fraunces headers, stacked cards) applies uniformly to all four.
