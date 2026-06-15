# Onboarding Welcome Carousel — Design

**Date:** 2026-06-15
**Status:** Approved, ready for implementation plan

## Overview

A 3-slide welcome carousel that introduces Byline's core loop to first-time
users. It shows once per device on first app load and is replayable any time
from Settings. The goal is to teach the *how* (the workflow), leaving the *why*
to the existing About modal and AI-consent detail to the existing consent gate.

## Goals

- Orient a first-time user to the core loop in ~30 seconds.
- Be skippable and non-blocking.
- Be replayable for users who skipped it or want a refresher at review time.
- Reuse existing patterns; add no dependencies; no database migration.

## Non-Goals (out of scope)

- The *why* / underselling research — already covered by `AboutModal`
  ("Why Byline?"), reachable via the Byline wordmark.
- AI consent explanation — handled in-context by `AiConsentGate` at the moment
  the user first triggers an AI action.
- Tags, rotating prompts, and settings detail — discoverable in place in the
  `EntryForm` and `SettingsDrawer`.

## Component: `WelcomeCarousel.tsx`

Modeled on the existing `AboutModal` pattern:

- Fixed full-screen overlay, backdrop click-to-close, Escape-to-close.
- `fadeIn` animation, `role="dialog"`, `aria-modal="true"`.

Differences from `AboutModal`:

- Internal `slide` state (0–2).
- Dot indicators showing position.
- **Back** / **Next** navigation; **Skip** link; **Get started** on the final
  slide.
- Props: `open: boolean`, `onClose: () => void`.
- Every dismissal path (Skip, Get started, backdrop, Escape) calls `onClose`.

### Slides (core loop)

1. **Log a win each day** — write what you did, in your own words. The daily
   prompt is there to spark ideas, not constrain you.
2. **Let the coach reframe it** — the AI coach rewrites self-diminishing
   language into confident, accurate impact statements, preserving the facts.
3. **Export your brag doc** — at review time, generate a polished, categorized
   summary you can copy straight into a self-review.
   - Footer line: "Tap **Byline** any time to learn more" — points to the
     existing About modal for the deeper *why*.

Copy follows the design guidelines' voice (encouraging, warm, confident) and
the no-emoji coding standard.

## Trigger & Persistence

- localStorage key: `byline.hasSeenWelcome`.
- In `App.tsx`, on mount: if the key is unset, open the carousel.
- On close (any path), set the key to `"1"`.
- Per-device behavior: the carousel re-appears once on a new browser/device or
  if browser data is cleared. This is acceptable — even mildly useful — for a
  short welcome tour, and avoids a Supabase migration and schema-cache risk.
- A trivial read/write helper keeps the flag access in one place. Kept minimal
  per coding standards (no defensive over-engineering).

## Replay Entry Point

- Location: `SettingsDrawer` → **Account** section (`AccountCard`).
- A secondary button styled like the existing "Sign out" button:
  **"Replay welcome tour."**
- Behavior: closes the drawer and opens the carousel.
- Wiring: `App.tsx` owns the carousel `open` state. It passes an
  `onReplayWelcome` callback down through `SettingsDrawer` to `AccountCard`,
  mirroring how `onClearData` already threads through the drawer.

## State Ownership & Data Flow

- `App.tsx` owns `welcomeOpen` state and the localStorage flag effect.
- `App.tsx` renders `<WelcomeCarousel open={welcomeOpen} onClose={...} />`
  alongside the existing `AboutModal` and `AiConsentGate`.
- `onClose` sets `welcomeOpen` to false and writes `byline.hasSeenWelcome`.
- `onReplayWelcome` (passed to `SettingsDrawer` → `AccountCard`) closes the
  drawer and sets `welcomeOpen` to true. Replay does not depend on the flag.

## Testing

`WelcomeCarousel.test.tsx`:
- Renders when `open`, nothing when closed.
- Slide navigation: Next advances, Back retreats, dots reflect position.
- Skip calls `onClose`.
- Get started (final slide) calls `onClose`.
- Escape calls `onClose`.

`App.test.tsx`:
- Carousel auto-opens when `byline.hasSeenWelcome` is unset.
- Carousel does not auto-open when the flag is set.
- The flag is written to localStorage on close.

Replay:
- `SettingsDrawer` / `AccountCard` test: the "Replay welcome tour" button fires
  its callback.

## Files Touched

- New: `frontend/src/components/WelcomeCarousel.tsx`
- New: `frontend/src/components/WelcomeCarousel.test.tsx`
- Edit: `frontend/src/components/App.tsx` — state, flag effect, render carousel,
  pass `onReplayWelcome`.
- Edit: `frontend/src/components/SettingsDrawer.tsx` — thread `onReplayWelcome`
  to `AccountCard`.
- Edit: `frontend/src/components/Settings.tsx` — replay button in `AccountCard`.
- Edit: `App.test.tsx` and a settings test as described above.
