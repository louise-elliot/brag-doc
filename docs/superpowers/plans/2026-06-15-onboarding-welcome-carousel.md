# Onboarding Welcome Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-slide welcome carousel that introduces Byline's core loop to first-time users, shown once per device on first load and replayable from Settings.

**Architecture:** A new `WelcomeCarousel` modal component (modeled on the existing `AboutModal`) is owned by `App.tsx`. A tiny localStorage helper tracks whether the user has seen it. On mount, `App` opens the carousel if the flag is unset and writes the flag on close. A "Replay welcome tour" button in the Settings → Account card re-opens it via a callback threaded through `SettingsDrawer`.

**Tech Stack:** Next.js (App Router, client components), TypeScript, Tailwind v4 (CSS custom properties from the design system), Vitest + React Testing Library.

**Project conventions:**
- Commits are handled manually by the user. Each task ends at "verify tests pass" — do NOT run `git commit`. After a task is green, hand back for the user to review and commit.
- No emojis anywhere in code or copy.
- Keep it simple — no defensive over-engineering (coding-standards.md).
- This is a modified Next.js; before writing component code consult `node_modules/next/dist/docs/` per `frontend/AGENTS.md` if anything about App Router behavior is unclear.

---

## File Structure

- **Create** `frontend/src/lib/welcome.ts` — localStorage read/write for the seen flag. Single responsibility: persistence of one boolean.
- **Create** `frontend/src/lib/welcome.test.ts` — unit tests for the helper.
- **Create** `frontend/src/components/WelcomeCarousel.tsx` — the modal carousel UI. Single responsibility: present 3 slides and report close.
- **Create** `frontend/src/components/WelcomeCarousel.test.tsx` — component tests.
- **Modify** `frontend/src/components/App.tsx` — own carousel state, auto-open effect, render carousel, pass `onReplayWelcome` to `SettingsDrawer`.
- **Modify** `frontend/src/components/App.test.tsx` — default existing tests to "already seen"; add auto-open / flag-write tests.
- **Modify** `frontend/src/components/SettingsDrawer.tsx` — accept `onReplayWelcome` prop and pass it to `AccountCard`.
- **Modify** `frontend/src/components/Settings.tsx` — `AccountCard` accepts `onReplayWelcome` and renders the replay button.
- **Modify** `frontend/src/components/SettingsDrawer.test.tsx` — test the replay button fires its callback.

---

## Task 1: localStorage flag helper

**Files:**
- Create: `frontend/src/lib/welcome.ts`
- Test: `frontend/src/lib/welcome.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/welcome.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { hasSeenWelcome, markWelcomeSeen } from "./welcome";

describe("welcome flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when the flag has never been set", () => {
    expect(hasSeenWelcome()).toBe(false);
  });

  it("returns true after markWelcomeSeen is called", () => {
    markWelcomeSeen();
    expect(hasSeenWelcome()).toBe(true);
  });

  it("persists the flag under the byline.hasSeenWelcome key", () => {
    markWelcomeSeen();
    expect(localStorage.getItem("byline.hasSeenWelcome")).toBe("1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/welcome.test.ts`
Expected: FAIL — cannot resolve `./welcome` / `hasSeenWelcome is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/welcome.ts
const KEY = "byline.hasSeenWelcome";

export function hasSeenWelcome(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function markWelcomeSeen(): void {
  localStorage.setItem(KEY, "1");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/welcome.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Hand back for commit**

Tests green. Leave staging/commit to the user.

---

## Task 2: WelcomeCarousel component

**Files:**
- Create: `frontend/src/components/WelcomeCarousel.tsx`
- Test: `frontend/src/components/WelcomeCarousel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/WelcomeCarousel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeCarousel } from "./WelcomeCarousel";

function renderCarousel(open: boolean, onClose = vi.fn()) {
  render(<WelcomeCarousel open={open} onClose={onClose} />);
  return { onClose };
}

describe("WelcomeCarousel", () => {
  it("renders nothing when closed", () => {
    renderCarousel(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with the first slide when open", () => {
    renderCarousel(true);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Log a win each day")).toBeInTheDocument();
  });

  it("Next advances to the second slide", async () => {
    renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Let the coach reframe it")).toBeInTheDocument();
  });

  it("Back returns to the previous slide", async () => {
    renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Log a win each day")).toBeInTheDocument();
  });

  it("shows Get started on the last slide", async () => {
    renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Export your brag doc")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Get started" })
    ).toBeInTheDocument();
  });

  it("Skip calls onClose", async () => {
    const { onClose } = renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Get started calls onClose", async () => {
    const { onClose } = renderCarousel(true);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape calls onClose", () => {
    const { onClose } = renderCarousel(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/WelcomeCarousel.test.tsx`
Expected: FAIL — cannot resolve `./WelcomeCarousel`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/WelcomeCarousel.tsx
"use client";

import { useEffect, useState } from "react";

interface WelcomeCarouselProps {
  open: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    title: "Log a win each day",
    body: "Write what you did, in your own words. The daily prompt is there to spark ideas, not box you in.",
  },
  {
    title: "Let the coach reframe it",
    body: "The AI coach rewrites self-diminishing language into confident, accurate impact statements, keeping your facts intact.",
  },
  {
    title: "Export your brag doc",
    body: "At review time, generate a polished, categorized summary you can copy straight into your self-review.",
  },
];

export function WelcomeCarousel({ open, onClose }: WelcomeCarouselProps) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!open) return;
    setSlide(0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Byline"
    >
      <button
        type="button"
        aria-label="Close welcome"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 border-none cursor-default"
        style={{ animation: "fadeIn 0.2s ease both" }}
      />
      <aside
        className="relative bg-white rounded-lg shadow-xl max-w-[520px] w-full"
        style={{ animation: "fadeIn 0.25s ease both" }}
      >
        <div className="px-10 py-12">
          <p className="font-body text-sm font-medium text-[var(--color-primary-600)] mb-3">
            Welcome to Byline
          </p>
          <h2 className="font-display text-3xl font-semibold leading-tight text-[var(--color-neutral-800)] mb-4">
            {current.title}
          </h2>
          <p
            className="font-body text-base text-[var(--color-neutral-700)]"
            style={{ lineHeight: 1.7 }}
          >
            {current.body}
          </p>
          {isLast && (
            <p className="font-body text-sm text-[var(--color-neutral-500)] mt-4">
              Tap Byline any time to learn more.
            </p>
          )}

          <div className="flex items-center gap-2 mt-8" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={[
                  "rounded-full w-2 h-2",
                  i === slide
                    ? "bg-[var(--color-primary-500)]"
                    : "bg-[var(--color-neutral-300)]",
                ].join(" ")}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={onClose}
              className="font-body text-sm font-medium text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-800)] bg-transparent border-none cursor-pointer"
            >
              Skip
            </button>
            <div className="flex gap-3">
              {slide > 0 && (
                <button
                  type="button"
                  onClick={() => setSlide((s) => s - 1)}
                  className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
                >
                  Back
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
                >
                  Get started
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSlide((s) => s + 1)}
                  className="font-body text-sm font-semibold bg-[var(--color-primary-500)] text-white rounded-md px-6 py-3 hover:bg-[var(--color-primary-600)] transition-colors cursor-pointer"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/WelcomeCarousel.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Hand back for commit**

Tests green. Leave staging/commit to the user.

---

## Task 3: Wire carousel into App (auto-open + flag write)

**Files:**
- Modify: `frontend/src/components/App.tsx`
- Modify: `frontend/src/components/App.test.tsx`

- [ ] **Step 1: Write the failing test**

First, make existing App tests deterministic by defaulting the flag to "seen" so the carousel does not auto-open over them. In `App.test.tsx`, update the existing `beforeEach` inside `describe("App", ...)`:

```tsx
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("byline.hasSeenWelcome", "1");
  });
```

Then add a new describe block at the end of the file:

```tsx
describe("App welcome carousel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("auto-opens the welcome carousel when the flag is unset", async () => {
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Welcome to Byline" })
      ).toBeInTheDocument()
    );
  });

  it("does not auto-open when the flag is already set", async () => {
    localStorage.setItem("byline.hasSeenWelcome", "1");
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByText("What impact did you make today?")
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("dialog", { name: "Welcome to Byline" })
    ).not.toBeInTheDocument();
  });

  it("writes the flag and closes when the user clicks Get started", async () => {
    render(<App />);
    await screen.findByRole("dialog", { name: "Welcome to Byline" });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(localStorage.getItem("byline.hasSeenWelcome")).toBe("1");
    expect(
      screen.queryByRole("dialog", { name: "Welcome to Byline" })
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: FAIL — the new "App welcome carousel" tests fail because no welcome dialog renders. Existing tests still pass.

- [ ] **Step 3: Implement the wiring in App.tsx**

Add the import near the other component imports (after the `AboutModal` import, around line 8):

```tsx
import { WelcomeCarousel } from "./WelcomeCarousel";
```

Add the helper import near the settings import (around line 10):

```tsx
import { hasSeenWelcome, markWelcomeSeen } from "@/lib/welcome";
```

Add carousel state alongside the other `useState` calls (near line 37, beside `aboutOpen`):

```tsx
  const [welcomeOpen, setWelcomeOpen] = useState(false);
```

Add an effect that opens the carousel on first load. Place it after the existing settings effect (after the block that ends around line 90):

```tsx
  useEffect(() => {
    if (!hasSeenWelcome()) setWelcomeOpen(true);
  }, []);

  function handleWelcomeClose() {
    markWelcomeSeen();
    setWelcomeOpen(false);
  }

  function handleReplayWelcome() {
    setSettingsOpen(false);
    setWelcomeOpen(true);
  }
```

Render the carousel next to the existing `AboutModal` (around line 355):

```tsx
      <WelcomeCarousel open={welcomeOpen} onClose={handleWelcomeClose} />
```

Pass the replay callback into the existing `SettingsDrawer` JSX (add the prop to the `<SettingsDrawer ... />` around lines 344-354):

```tsx
        onReplayWelcome={handleReplayWelcome}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: PASS — existing tests plus the 3 new welcome tests.

Note: `SettingsDrawer` does not yet accept `onReplayWelcome`; TypeScript will flag the new prop until Task 4. The Vitest run still passes because the prop is forwarded loosely at runtime, but run the type check after Task 4 (Task 5).

- [ ] **Step 5: Hand back for commit**

Tests green. Leave staging/commit to the user.

---

## Task 4: Replay button in Settings → Account

**Files:**
- Modify: `frontend/src/components/SettingsDrawer.tsx`
- Modify: `frontend/src/components/Settings.tsx` (`AccountCard`)
- Modify: `frontend/src/components/SettingsDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `SettingsDrawer.test.tsx`. The drawer opens on the "You" section by default, so the test must first switch to the "Account" tab. Append inside the existing `describe("SettingsDrawer", ...)` block:

```tsx
  it("Replay welcome tour button calls onReplayWelcome", async () => {
    const onReplayWelcome = vi.fn();
    renderDrawer(true, { onReplayWelcome });
    await userEvent.click(screen.getByRole("tab", { name: "Account" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Replay welcome tour" })
    );
    expect(onReplayWelcome).toHaveBeenCalled();
  });
```

Also add `onReplayWelcome: vi.fn(),` to the `props` object inside the existing `renderDrawer` helper so other tests keep type-checking:

```tsx
    onClearData: vi.fn(),
    onReplayWelcome: vi.fn(),
    aiConsent: false,
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SettingsDrawer.test.tsx`
Expected: FAIL — no button named "Replay welcome tour".

- [ ] **Step 3: Implement — thread the prop and render the button**

In `SettingsDrawer.tsx`, add to `SettingsDrawerProps` (after `onClearData`, around line 23):

```tsx
  onReplayWelcome: () => void;
```

Destructure it in the function signature (after `onClearData`, around line 43):

```tsx
  onReplayWelcome,
```

Pass it to `AccountCard` (replace the `{section === "account" && <AccountCard />}` line, around line 140):

```tsx
            {section === "account" && (
              <AccountCard onReplayWelcome={onReplayWelcome} />
            )}
```

In `Settings.tsx`, change the `AccountCard` signature (line 459):

```tsx
export function AccountCard({
  onReplayWelcome,
}: {
  onReplayWelcome: () => void;
}) {
```

Add the replay button to the existing button row. Replace the closing `</div>` of the `flex gap-3` button row (the `</div>` on line 530) so the button sits beside "Sign out" and "Delete account":

```tsx
        <button
          type="button"
          onClick={onReplayWelcome}
          className="font-body text-sm font-medium bg-transparent border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] rounded-md px-6 py-3 hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
        >
          Replay welcome tour
        </button>
      </div>
```

(The new `<button>` goes immediately before the `</div>` that closes the `<div className="flex gap-3">` row.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/SettingsDrawer.test.tsx`
Expected: PASS — including the new replay test.

- [ ] **Step 5: Hand back for commit**

Tests green. Leave staging/commit to the user.

---

## Task 5: Full verification

- [ ] **Step 1: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (confirms the `onReplayWelcome` prop now type-checks end to end).

- [ ] **Step 2: Run the full unit suite**

Run: `cd frontend && npx vitest run`
Expected: all tests pass.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `cd frontend && npm run dev`, sign in, and in the browser console run `localStorage.removeItem("byline.hasSeenWelcome")`, reload. Verify:
- Carousel auto-opens on the first slide.
- Next/Back and dots work; "Get started" closes it; reloading does not reopen it.
- Settings → Account → "Replay welcome tour" reopens it.

- [ ] **Step 5: Hand back for commit**

All green. Leave the final staging/commit to the user.

---

## Notes for the implementer

- The carousel reuses the `AboutModal` overlay pattern exactly (backdrop button, `fadeIn` animation, Escape handler), so styling and a11y stay consistent with the rest of the app.
- The seen-flag is intentionally per-device (localStorage), so the carousel may reappear once on a new browser. This is by design — see the spec. The replay button works regardless of the flag.
- Do not add the flag to Supabase settings; that was explicitly rejected to avoid a migration and schema-cache risk.
