# Custom Categories Design

## Goal

Let users add, rename, and delete the categories (tags) used to classify journal entries. Replace the hardcoded 6-tag list with a user-managed list.

## Decisions

| Decision | Choice |
|---|---|
| Past entries when tag is deleted | Keep the tag on old entries; only remove it from the picker |
| Where management UI lives | Settings tab (new "Categories" card above the existing "Clear all data" card) |
| Colors for new tags | User picks from a curated palette of swatches (design-safe) |
| Rename support | Yes — rename sweeps through all entries and updates the tag string |
| Reset to defaults | No button — defaults are a starting point only |

## Data Model

New localStorage key `confidence-journal:tags`:

```ts
interface TagDef {
  name: string;   // canonical, trimmed, lowercased for dedup checks
  color: string;  // hex from the curated palette
}
```

- Seeded with the 6 defaults on first run (if key is absent).
- `Entry.tags: string[]` is unchanged — stays as plain name strings.
- Tag colors on old entries: look up by name in `availableTags` first; if absent, render a neutral gray chip.

## Curated Color Palette

8 swatches, all harmonized with the warm dark editorial theme. The 6 existing tag colors plus two extras:

```
#D4863C  (amber, leadership default)
#6B8AE0  (blue, technical default)
#4CAF82  (green, collaboration default)
#C978D6  (violet, problem-solving default)
#E0C46B  (gold, communication default)
#E07272  (coral, mentoring default)
#8AB4B8  (teal, new)
#B89878  (warm taupe, new)
```

Each swatch derives its `bg` (12% alpha) and `border` (30% alpha) in the same pattern as the existing `TAG_COLORS`.

## Settings Tab Layout

Two stacked cards:

### Card 1 — Categories (new, top)

- Header: "Categories" (mono uppercase small label)
- Description: "These are the tags you can apply to entries. Deleting a category removes it from the picker — past entries keep their tag."
- **Row per existing tag:**
  - Color dot (10px) in the tag's color
  - Tag name — click to edit inline (Enter/blur commits, Escape cancels)
  - `×` button (tertiary text; danger red on hover)
- **Add row at bottom:**
  - Text input (placeholder: "New category name…")
  - Row of 8 color swatches (selected one has an accent-colored ring). Defaults to the next unused color from the palette.
  - "Add" button — disabled when name is empty, whitespace-only, or a case-insensitive duplicate of an existing tag.

### Card 2 — Data (existing, below)

- Unchanged content: "Clear all data" with the current confirmation dialog.

## Interactions

- **Delete**: single click `×`, no confirmation. Reversible by re-adding. Past entries keep the tag string.
- **Rename**: inline edit on the tag row. On commit, rewrite the tag string on every entry that had the old name. Case-insensitive duplicate check applies to the new name.
- **Empty list**: if the user deletes every tag, the entry form's `TagPicker` renders nothing (entries already support saving with no tags).
- **Validation**:
  - Trim on add/rename.
  - Case-insensitive dedup (`leadership` vs `Leadership`).
  - Reject empty/whitespace-only names.
  - No hard max length (sensible default via CSS truncation at ~30 chars display width, but no blocking validation).

## Files Touched

- `src/lib/types.ts` — remove the hardcoded `TAGS` const and `Tag` type. Introduce `TagDef`.
- `src/lib/tags.ts` — replace the static `TAG_COLORS` with the palette + CRUD helpers (`getTags`, `addTag`, `deleteTag`, `renameTag`, `getTagColor`).
- `src/components/TagPicker.tsx` — read from `getTags()` instead of the const.
- `src/components/EntryList.tsx` — resolve tag colors via `getTagColor(name)` with fallback.
- `src/components/BragDoc.tsx` — same resolution path if it styles tag names.
- `src/components/Settings.tsx` — add the Categories card above the existing Data card.
- `src/components/App.tsx` — wire rename (which updates entries in localStorage) so the in-memory entries list refreshes.

## Test Strategy

Unit (Vitest + RTL):
- `tags.ts`: seed on first run, add, delete, rename (+ sweep entries), dedup, color fallback.
- `Settings`: renders category rows, add flow, delete click, inline rename, validation states.
- `TagPicker`: reflects current custom tag list.

E2E (Playwright):
- Add a category, use it on an entry, see it on the list.
- Delete a category, verify it disappears from picker but remains on past entry.
- Rename a category, verify the old name updates on past entries.
