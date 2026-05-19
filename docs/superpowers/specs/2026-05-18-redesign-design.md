# Confidence Journal — Visual Redesign Spec

**Date:** 2026-05-18
**Goal:** Replace the current dark editorial theme with the light warm theme defined in `docs/superpowers/specs/DESIGN_GUIDELINES.md`. Visual-only refresh — functionality, data model, and API surface are unchanged.

---

## Scope decisions

- **Full replacement.** The dark theme is removed entirely. There is no light/dark toggle. All current inline `style={{}}` props on components migrate to Tailwind utility classes that resolve against the new theme tokens.
- **Strip atmospheric effects.** The body-level noise overlay and radial-gradient bloom are removed. Entrance animations (staggered `fadeInUp`) are kept.
- **Custom tags, no tag colors.** The user-customizable tag system stays (add / delete / rename). All per-tag colors are removed; every tag uses a single uniform neutral pill style. The color picker is removed from tag management.
- **Layout widths follow the guide.** Outer container `max-w-[1200px]`, inner reading column `max-w-[800px]` for Journal and Settings. Brag Doc uses the full 1200px.
- **Settings stays single-column.** The guide's 2-column sidebar pattern is skipped — only two sections (Tags, Data) and a sidebar would feel empty.

## What does NOT change

- Component file structure under `frontend/src/components/`.
- Data model (`Entry`, `TagDef`), localStorage keys, prompt pool.
- API routes (`/api/reframe`, `/api/generate-brag-doc`) and their request/response shapes.
- Tab structure (Journal / Brag Doc / Settings) and the save-then-reframe flow.

---

## Theme tokens (`frontend/src/app/globals.css`)

Wholesale replacement of the `@theme {}` block.

**Colors.** Drop `--color-base`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-border-subtle`, `--color-text-primary/secondary/tertiary`, `--color-accent*`, `--color-positive*`, `--color-danger*`, and all `--tag-*` variables. Replace with the guide's scales:

- `--color-primary-50` through `--color-primary-900` (terracotta, `#d96440` is the 500)
- `--color-neutral-0` through `--color-neutral-900` (warm neutrals, `#ffffff` is 0)
- `--color-success-{50,500}`, `--color-warning-{50,500}`, `--color-error-{50,500}`, `--color-info-{50,500}`

The guide's category color palette is also dropped — categories are not part of this redesign.

**Fonts.** Keep Fraunces (already in use). Replace Outfit with Inter. Replace IBM Plex Mono with JetBrains Mono. Token names `--font-display`, `--font-body`, `--font-mono` stay; their values change. `@font-face` blocks in `globals.css` are updated accordingly, or replaced with Google Fonts `@import` lines per the guide.

**Spacing / radii / shadows / transitions.** Adopt the guide's full ramps verbatim:

- `--spacing-0` through `--spacing-24` (4px base unit)
- `--radius-sm/md/lg/xl/full`
- `--shadow-sm/md/lg/xl`
- `--transition-fast: 150ms ease`, `--transition-base: 200ms ease`, `--transition-slow: 300ms ease`

**Body.** Remove `body::before` (noise SVG) and `body::after` (radial bloom). Body background `--color-neutral-0` (white). Default text `--color-neutral-600`. Custom scrollbar kept; recolored to `--color-neutral-200` track / `--color-neutral-400` thumb.

**Animations.** `fadeInUp`, `fadeIn`, `reframeReveal`, `saveCheck`, `shimmer` keyframes are kept verbatim. `saveFlash` keyframes have their `rgba(212, 134, 60, …)` calls repointed to `rgba(217, 100, 64, …)` (the new primary-500 rgb).

---

## Typography hierarchy

Components currently lean small + mono. The new hierarchy uses Fraunces for editorial moments and pushes the type scale wider.

| Element | Size | Family | Weight | Notes |
|---|---|---|---|---|
| Today's prompt (hero) | `text-4xl` (36px) | Fraunces | 600 | Editorial centerpiece of Journal tab |
| Page / section titles | `text-2xl` (24px) | Fraunces | 600 | "Past entries", "Your wins this month", Settings sections |
| Brand wordmark | `text-xl` (20px) | Fraunces | 700 | Persistent chrome |
| Card subheadings (entry date) | `text-lg` (18px) | Fraunces | 500 | |
| Tab labels | `text-sm` (14px) | Inter | 500 | Sentence-case — replaces current uppercase mono |
| Body / journal entries | `text-base` (16px) | Inter | 400 | `line-height: 1.6`. Entries themselves bump to `text-lg`, `line-height: 1.75` per guide |
| Buttons (primary) | `text-sm` | Inter | 600 | |
| Buttons (secondary / ghost) | `text-sm` | Inter | 500 | |
| Metadata (date, count, tag pills) | `text-xs` (12px) | Inter | 500 | |
| Placeholders | `text-base` | Inter | 400 | `text-neutral-400` |

**Notable deviations from current:**

- Tab labels become sentence-case Inter instead of uppercase mono. The mono treatment suited the dark editorial vibe; against the light warm canvas it reads clinical.
- Date in header becomes Inter `text-xs` `text-neutral-500` — no more spaced-out caps.

---

## Layout & shell

**Outer container.** `max-w-[1200px]` centered. Side padding `--spacing-12` (48px) on desktop, `--spacing-4–6` on mobile. Top padding `--spacing-12`.

**Inner reading column.** `max-w-[800px]` for Journal and Settings tab panels. Brag Doc uses the full 1200px.

**Header.**
- Brand left (`text-xl` Fraunces 700). The vertical orange accent bar to the left of "Confidence" is removed — the wordmark stands alone.
- Date right (`text-xs` Inter, `text-neutral-500`).
- Border-bottom `1px solid --color-neutral-200` (anchors the chrome against the lighter palette; currently this border sits on the tab nav).

**Tab nav.** Tabs sit beneath the header, left-aligned, `--spacing-8` (32px) between. Active tab: `--color-primary-500` 2px underline + `text-neutral-800`. Inactive: `text-neutral-500`, hover `text-neutral-700`. No background pill.

**Main content.** Top padding `--spacing-10` (40px) below tab nav. Section spacing between Journal "today's entry" and "past entries" is `--spacing-16` (64px), up from current 48px.

**Settings page.** Single column inside the 800px reading width. Two sections stacked vertically: "Tags" then "Data". Each gets a Fraunces `text-2xl` header. `--spacing-12` (48px) between sections.

**Past entries count.** Currently a small mono chip beside the heading. Replaced by inline metadata: "Past entries · 12" with the count in `text-neutral-500`.

---

## Component restyles

Functionality unchanged unless flagged. Visual deltas only.

### EntryForm

- Prompt as hero: `text-4xl` Fraunces, `text-neutral-800`, `--spacing-8` margin-bottom.
- Refresh-prompt button: ghost button (transparent, `text-neutral-500`, hover `bg-neutral-100`), positioned beneath the prompt, not competing with it.
- Textarea per guide: `bg-neutral-50` when empty, `bg-white` when focused. `1px` `neutral-300` border, `radius-md`, `text-lg`, `line-height: 1.75`, `min-h-[120px]`, padding `--spacing-4 --spacing-5`. Focus ring `--color-primary-100`, border `--color-primary-500`. Placeholder `text-neutral-400`.
- TagPicker sits below textarea without a card wrapper.
- "Save" is the primary button, right-aligned.

### TagPicker

- One uniform chip style regardless of tag name. Unselected: `bg-neutral-100`, `text-neutral-700`. Selected: `bg-primary-100`, `text-primary-700`. Pill (`radius-full`). `text-xs` Inter 500. Padding `--spacing-1 --spacing-3`.
- Hover (unselected): `bg-neutral-200`. Hover (selected): no change.

### EntryList

- Each entry in a card per guide: `bg-white`, `1px neutral-200` border, `radius-lg`, padding `--spacing-6`, `shadow-sm`. Hover lifts to `shadow-md` via `--transition-base`.
- Gap between cards: `--spacing-6` (24px). The guide suggests 32px between entries; bordered cards already provide visual separation, so 24px feels tuned.
- Entry header row: date top-left (`text-lg` Fraunces 500), tag pills inline right.
- Body text `text-base`, `text-neutral-700`.
- "Show reframed" toggle: ghost-button link beneath the original text.
- Empty state: centered Fraunces `text-2xl` "No wins yet — they'll be here when you're ready" + Inter `text-base` `text-neutral-500` subtitle below.

### ReframeView

- Rendered inline within an entry card after save.
- Exact guide pattern for AI Coach Messages: `bg-primary-50`, `border-left: 3px solid --color-primary-500`, `radius-md`, padding `--spacing-5`.
- "Reframed:" label `text-primary-700`, weight 600, `text-sm`.
- Reframed body text `text-base`, `text-neutral-700`.
- Accept = primary button. Dismiss = ghost button.

### CoachMessage / CoachNotePills / CoachPanel

- All three collapse into the same Coach visual language as ReframeView: `bg-primary-50` surface, `border-left: 3px solid --color-primary-500`, `text-primary-700` label.
- CoachNotePills: small pills, `bg-primary-100`, `text-primary-700`, `text-xs` Inter 500. Same shape as tag pills but tinted to distinguish them as coach content.
- No color variations across the three components — they all read as "the coach is saying something."

### BragDoc

- Date-range filter row at top: pill group ("30 days" / "Quarter" / "6 months" / "All time"). Active: `bg-neutral-100`, `text-neutral-800`. Inactive: transparent, `text-neutral-500`, hover `bg-neutral-100`.
- "Generate" = primary button.
- Output: Fraunces `text-2xl` tag-group headings, Inter `text-base` `line-height: 1.75` bullets, `--spacing-10` between groups.
- "Copy to clipboard" = secondary button top-right of output.
- Copy success toast: `bg-success-50`, `text-success-500` pill, fades after ~1.5s.

### Settings

- Tags section: list of tag rows. Each row = tag name (Inter `text-base`) + inline "Rename" ghost button + "Delete" ghost button (`text-error-500`, hover `bg-error-50`).
- "Add tag" row at the bottom: text input + primary button. No color picker.
- Data section: "Clear all data" as a danger button (`bg-error-50`, `text-error-500`; hover `bg-error-500` text white).
- Confirmation dialog structurally unchanged. Restyled as white card with `shadow-xl`, `radius-lg`, `--spacing-8` padding.

---

## Buttons (canonical styles)

Defined once so components stay consistent.

**Primary.** `bg-primary-500`, `text-white`, padding `--spacing-3 --spacing-6`, `radius-md`, Inter 600, `text-sm`. Hover `bg-primary-600`. Focus ring `--color-primary-300`. Transition `--transition-fast`.

**Secondary.** Transparent bg, `text-neutral-700`, `1px solid neutral-300`, padding `--spacing-3 --spacing-6`, `radius-md`, Inter 500, `text-sm`. Hover `bg-neutral-100`.

**Ghost.** Transparent bg, `text-neutral-600`, no border, padding `--spacing-3 --spacing-4`, Inter 500, `text-sm`. Hover `bg-neutral-100`.

**Danger.** `bg-error-50`, `text-error-500`, padding `--spacing-3 --spacing-6`, `radius-md`, Inter 600, `text-sm`. Hover `bg-error-500`, `text-white`.

---

## Motion

**Entrance.** Initial mount keeps the staggered `fadeInUp` cascade: header → tab nav → main content → past entries. `animate-delay-1/2/4` utility classes remain.

**Component reveal.** `reframeReveal` keyframe used when Coach/Reframe panel slides in beneath an entry.

**Save moment.** `saveCheck` keyframe for the post-save checkmark. `saveFlash` keyframe repointed to primary-500 rgb.

**Loading.** `shimmer` keyframe used while `/api/reframe` is in flight.

**Transitions.** Adopt guide tokens consistently:
- Button color/bg hover → `--transition-fast`
- Card shadow hover → `--transition-base`
- Coach / Reframe panel show/hide → `--transition-slow`

**Hover.**
- Cards: `shadow-sm` → `shadow-md`. No transform.
- Primary buttons: `bg-primary-500` → `bg-primary-600`. No scale.
- Ghost / secondary buttons: bg transparent → `bg-neutral-100`.

The guide allows a subtle `scale(1.02)` on button hover; this redesign skips it — it reads more SaaS-marketing than coach.

---

## Files affected

**Modified:**

- `frontend/src/app/globals.css` — theme tokens, fonts, body styles, keyframe rgb tweak
- `frontend/src/app/layout.tsx` — likely unchanged, but verify font loading lives in `globals.css`
- `frontend/src/components/App.tsx` — header, tab nav, container widths, remove inline styles
- `frontend/src/components/EntryForm.tsx` — hero prompt, textarea, refresh-prompt button, save button
- `frontend/src/components/EntryList.tsx` — card pattern, header row, empty state, reframed toggle
- `frontend/src/components/TagPicker.tsx` — uniform neutral pill style, remove color handling
- `frontend/src/components/ReframeView.tsx` — coach message pattern
- `frontend/src/components/CoachMessage.tsx` — coach message pattern
- `frontend/src/components/CoachNotePills.tsx` — primary-tinted pills
- `frontend/src/components/CoachPanel.tsx` — coach message pattern
- `frontend/src/components/BragDoc.tsx` — filter pills, output typography, copy toast
- `frontend/src/components/Settings.tsx` — tag rows, remove color picker, danger button styling
- `frontend/src/lib/tags.ts` — drop `color` field from `TagDef` (or keep field but ignore in UI — preference: drop, since it's no longer used)

**Not affected:**

- `frontend/src/lib/entries.ts`, `frontend/src/lib/prompts.ts`, `frontend/src/lib/dates.ts`, `frontend/src/lib/types.ts` (no visual concerns)
- API routes in `frontend/src/app/api/`
- Test files — they'll need updates wherever they assert on inline-style strings, dark-theme colors, or the removed accent bar, but the component contracts they test don't change.

---

## Migration / data considerations

- `TagDef.color` field: if removed from the type, existing user tag entries in localStorage will still parse correctly (extra fields are tolerated by the existing read code) but the color will be ignored. No migration needed; users see their tags re-styled uniformly on next load.
- No `Entry` shape changes.
- No API contract changes.

---

## Out of scope

- Light/dark toggle
- Category color system from the guide (not adopted — tags are uniform)
- Component library extraction into reusable `Button`/`Card`/`Input`/`Tag` primitives (deferred; this pass uses utility classes directly in each component)
- Responsive breakpoint refinements beyond what utility classes give for free
- Copy/voice changes (the empty-state line is the one exception)

---

## Testing notes

- Vitest assertions that look at hex colors, `font-family` mono lookups, or specific inline-style strings will break. Update assertions to check semantic state (e.g., `aria-selected`) rather than presentation strings.
- Playwright specs should still pass — flows are unchanged. Worth re-running `journal.spec`, `brag-doc.spec`, `persistence.spec` end-to-end after the redesign as a smoke check.
