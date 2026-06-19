# Mobile-Responsive Pass + Unified Coach Chat — Design

Date: 2026-06-19

## Problem

Byline was built desktop-first with hardcoded large sizing and no responsive
breakpoints. A user on mobile reported it is "not optimised for mobile." Two
distinct problems:

1. **Layout breaks on narrow screens.** Fixed `px-12` page padding, a
   `max-w-[1200px]` container, a four-item header crammed on one row, and a
   `grid-cols-2` reframe view all assume desktop width.
2. **The coach conversation requires a lot of scrolling.** `CoachPanel` renders
   the entire transcript inline in the page (`flex flex-col gap-4`), with the
   reply box *below* the whole transcript and no auto-scroll. Each long coach
   response grows the page; reading the newest reply and responding means
   scrolling past everything. Worse on mobile.

## Goals

- First-class, polished mobile experience across every screen, modal, and flow.
- Keep the existing top-tab navigation and inline desktop structure where it
  works; adapt, don't redesign.
- Fix the coach scrolling at the structural level, not just by trimming text.

## Non-goals (YAGNI)

- No bottom nav, hamburger menu, or separate mobile components.
- No new dependencies.
- No redesign of any user flow.
- No long-message truncation in the coach (tracked in backlog "Could Do"; the
  bounded scroll area already contains long content).

## Approach

A responsive-CSS pass on existing components (same DOM, mobile-first: small base
values with `sm:`/`lg:` prefixes restoring desktop sizing), plus one structural
refactor of the coach conversation into a unified responsive chat modal.

Breakpoint seams: Tailwind defaults — **sm = 640px** is the main mobile/desktop
seam, **lg = 1024px** restores the widest desktop spacing.

---

## Part 1 — Responsive CSS pass

### Viewport
- Add an explicit `viewport` export to `app/layout.tsx`
  (`width=device-width, initial-scale=1`). Next injects a default; making it
  explicit ensures it is never accidentally lost.

### Page chrome (`App.tsx`)
- Side padding: `px-12` → `px-4 sm:px-6 lg:px-12` (header, nav, main).
- Header: hide the date label below `sm`; bump the gear + sign-out buttons from
  `w-9 h-9` (36px) to a 44px minimum touch target on mobile.
- Nav tabs: reduce `gap-8` / `px-12` / `pt-12` to mobile-friendly values,
  restoring desktop values at `lg`.
- Scale the large vertical rhythm (`mt-16`, `pb-20`, etc.) down on small
  screens.

### Reframe view (`ReframeView.tsx`)
- The one true layout break: `grid grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
  so original/reframed **stack** on a phone.

### Dense components
- `EntryList` row action icons (`p-1`), and `BragDoc` / `EntryForm` button rows:
  ensure 44px tap targets and `flex-wrap` where a row could overflow a narrow
  screen.

### Overlays
- Settings drawer, About, Welcome carousel, consent gate already use
  `w-full max-w-[…]` with padded backdrops, so they collapse to full-width on a
  phone. Verify each scrolls correctly and its internal button rows wrap at the
  smallest sizes.

---

## Part 2 — Unified coach chat modal

Replace the inline per-row `CoachPanel` with a single responsive chat modal used
on **both** desktop and mobile.

### Surface
- New modal shell: `fixed inset-0` backdrop, centered card on desktop
  (`max-w-[…] w-full`, matching the existing About / consent-gate modals),
  **full-screen on mobile**.
- Three-region layout:
  1. **Fixed header** — title + close.
  2. **Bounded scrollable transcript** (`flex-1 overflow-y-auto`) that
     **auto-scrolls to the newest message** when it arrives.
  3. **Pinned composer** at the bottom (reply box + Send / "Reframe it now")
     that never scrolls away.
- This is the structural fix: the page no longer grows, and the input stays put.
- The `ReframeView` accept/dismiss continues to render inside the same surface
  during the reframe phase.

### Mount change
- Lift `CoachPanel` out of the per-row `.map()` in `EntryList` into a single
  instance rendered when `coachOpenId !== null` (entry looked up by id). The
  existing `onAccept` / `onDismiss` / `onClose` callbacks carry over unchanged.

### Entry as the first message (display-only)
- Render the user's original entry as the **first user bubble** at the top of
  the transcript, reusing the existing `CoachMessage` component
  (`role: "user"`), with the generating `prompt` shown as a small caption above
  it (e.g. "Responding to: *<prompt>*").
- **Critical constraint:** this is **presentation-only**. The entry must NOT be
  spliced into the `messages` array sent to the API. The backend already
  receives the entry separately as `entry_text`; adding it to `conversation`
  would send it twice — confusing the model, double-counting tokens, and
  skewing the rate limit.
- Keep the synthetic bubble separate from `messages` (prepend at render time)
  so the existing index-based logic — `lastMessageIndex` / "animate the latest
  coach message" — is unaffected.

### Content lever (light touch)
- Lightly tighten the backend `coachTurn` system prompt so replies are more
  concise. Careful, minimal change to preserve the warm coaching tone. This
  complements the layout fix rather than replacing it.

---

## Testing

- **New Playwright spec** at a mobile viewport (390×844, e.g. iPhone):
  - Journal loads with **no horizontal page overflow**.
  - Write and save an entry.
  - Open the coach; assert the transcript scrolls **within its region** (the
    page does not grow) and the composer stays visible.
  - The entry appears as the first message in the transcript.
  - Reframe panes stack vertically.
- **Manual smoke** at 320 / 390 / 768px.
- **Unit suite stays green.** The className changes don't touch test assertions;
  `CoachPanel` / `EntryList` tests are updated for the modal mount.
- Run `npm run lint` and `npm test` before claiming done (lint is part of the
  green bar; tsc/tests miss lint-only failures).

## Backlog spun off

- Coach transcript long-message truncation ("show more") — added to
  `backlog.txt` under "Could Do". Build only if testing shows long content
  dominates the bounded scroll area.
