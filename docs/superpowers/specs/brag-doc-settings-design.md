# Brag Doc Settings Design

## Goal

Let users customize brag doc generation with four settings: timeframe, organise-by grouping, tag filter, and a free-text guidance prompt.

## Decisions

| Decision | Choice |
|---|---|
| Timeframe options | Last month, Last quarter, YTD, Last year, All time (calendar-based) |
| Group-by options | Tag, Month, Chronological (no groups) |
| Tag filter default | All tags selected + "Untagged" chip selected |
| Tag filter semantics | OR — entry included if any of its tags is selected |
| Empty tag selection | Generate disabled, helper text "Select at least one tag" |
| Free-text prompt | Always-visible textarea, no char limit, ephemeral within session |
| API response shape | Unchanged — `{ bullets: [{ tag, points }] }`, where `tag` is the group label (tag name / month / "") |

## UI Layout (Brag Doc tab)

Single **Settings card** above the Generate button. Card contents top to bottom:

1. **Timeframe** — select dropdown.
2. **Organise by** — select dropdown.
3. **Tags** — chip row (TagPicker visual style) with all current tags + "Untagged" chip.
4. **Anything else?** — 2–3 line textarea. Placeholder: *"Anything you want to emphasize? e.g. 'focus on cross-functional impact', 'this is for a promo case to director level'..."*

**Generate** button sits below the card. When all tag chips are deselected, Generate is disabled and a helper line "Select at least one tag" appears next to it.

The card uses the same surface / border / radius tokens as the existing Settings cards for visual consistency.

## Timeframe Computation

A new helper in `src/lib/dates.ts`:

```ts
export type Timeframe =
  | "last-month"
  | "last-quarter"
  | "ytd"
  | "last-year"
  | "all";

export function computeDateRange(
  timeframe: Timeframe,
  today: Date = new Date()
): { start: string; end: string };
```

Semantics (all calendar-based, relative to `today`):
- `last-month`: first day of the previous calendar month to last day of the previous calendar month.
- `last-quarter`: first day of the previous calendar quarter to last day of the previous calendar quarter.
- `ytd`: Jan 1 of this year to `today`.
- `last-year`: Jan 1 to Dec 31 of the previous calendar year.
- `all`: `start: "0000-01-01"`, `end: today` (effectively unbounded lower).

Returns ISO date strings (`YYYY-MM-DD`) for consistent comparison against `Entry.date`.

## Tag Filter Logic

On the client, before calling the API:

```ts
const selectedSet = new Set(selectedTagNames);  // e.g. {"leadership", "__untagged__"}
const filtered = entries
  .filter((e) => e.date >= range.start && e.date <= range.end)
  .filter((e) => {
    if (e.tags.length === 0) return selectedSet.has("__untagged__");
    return e.tags.some((t) => selectedSet.has(t));
  });
```

The `"__untagged__"` sentinel is an internal selection key; it never appears in an entry's actual tags array.

## API Changes

`POST /api/generate-brag-doc` request body:

```ts
{
  entries: Entry[],                                        // required, already filtered client-side
  groupBy: "tag" | "month" | "chronological",              // required, defaults to "tag" if absent for back-compat
  userPrompt?: string,                                     // optional, omitted when empty/whitespace
}
```

Response shape unchanged: `{ bullets: [{ tag: string, points: string[] }] }`.

### System prompt templating

The base prompt stays the same ("You are a performance review coach for women in tech..."). A group-by clause is appended per `groupBy`:

- **tag**: current behaviour. *"Group bullets by tag category. Each group's `tag` field is the tag name."*
- **month**: *"Group bullets by calendar month based on each entry's date. Each group's `tag` field is the month label in the form 'Month YYYY' (e.g. 'April 2026'). Order groups newest-first."*
- **chronological**: *"Return a single group with the `tag` field set to an empty string. Include bullets ordered newest-first across all entries."*

If `userPrompt` is present (after trim): append *"\n\nThe user has added this additional guidance: <userPrompt>\n\nHonor it while keeping your core role as a performance review coach."*

## Frontend Response Rendering

`BragDoc`'s output rendering already iterates `bullets`. One small change: hide the `<h3>` group heading when `tag === ""` (chronological case), so a flat list renders cleanly without an empty heading.

The copy-to-clipboard formatter stays tag-aware but also handles empty tag: skip the heading line, just emit bullets.

## Files Touched

- `src/lib/dates.ts` — add `Timeframe` type and `computeDateRange`.
- `src/lib/dates.test.ts` — cover each timeframe branch with a fixed `today`.
- `src/app/api/generate-brag-doc/route.ts` — accept new fields, template system prompt.
- `src/app/api/generate-brag-doc/route.test.ts` — cover groupBy variants and userPrompt injection.
- `src/components/BragDoc.tsx` — overhaul UI; accept `tags` prop; new state for all four settings.
- `src/components/BragDoc.test.tsx` — cover disabled state, tag filter behaviour, API payload shape, chronological rendering.
- `src/components/App.tsx` — pass `tags` prop through to `BragDoc`.
- `e2e/brag-doc.spec.ts` — update existing generate flow test; add coverage for one alternative grouping.

## Test Strategy

### Unit

- `computeDateRange`: each option returns the expected bounds for a known `today` (e.g. today = 2026-04-24).
- `/api/generate-brag-doc`: each `groupBy` value produces a system prompt containing the expected group-by instructions; presence of `userPrompt` appends guidance; empty/whitespace `userPrompt` does not; response parsing works for all three group shapes.
- `BragDoc`: renders settings card; timeframe change triggers filter; deselecting all tags disables Generate + shows helper; chronological output hides the group heading.

### E2E

- Generate brag doc with default settings (all, tag, all tags, no prompt) — existing behaviour stays green.
- Switch group-by to Chronological and generate — output renders with no headings.
- Deselect every tag chip — Generate button is disabled.
