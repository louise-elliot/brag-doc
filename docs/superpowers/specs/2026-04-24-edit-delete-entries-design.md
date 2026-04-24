# Edit and Delete Past Entries Design

## Goal

Let users edit and delete individual past journal entries from the timeline on the Journal tab.

## Decisions

| Decision | Choice |
|---|---|
| What is editable | `original` text and `tags` only. Date, prompt, and `reframed` are not user-editable here. |
| Where the edit UI lives | Inline on the entry row — the row expands in place into an edit form. |
| Delete confirmation | Inline confirm — the row body is replaced by a "Delete this entry?" prompt with Yes/Cancel. No modal. |
| Affordance visibility | Edit and Delete icon buttons are always visible on every entry row, styled subtly in tertiary gray. |
| Reframed handling on text edit | Set `reframed = null` atomically when `original` changes. Keep `reframed` intact when only `tags` change. |
| Reframe again | A "Reframe again" link is shown on any entry where `reframed === null` in display mode. |
| Multiple rows in edit/confirm mode | Only one at a time — opening a second row cancels the first. |

## Data Operations

New functions in `src/lib/entries.ts`, alongside the existing `addEntry` / `updateEntry` / `deleteAllEntries`:

```ts
export function deleteEntry(id: string): void;

export function editEntry(
  id: string,
  updates: { original?: string; tags?: string[] }
): void;
```

- `deleteEntry` removes the matching entry from the stored array. No-op if the id is not found.
- `editEntry` writes the provided fields. If `updates.original` is present and differs from the current entry's `original`, it also sets `reframed: null` in the same write. Tag-only updates leave `reframed` untouched. No-op if the id is not found.

The existing `updateEntry` is kept as a lower-level helper for the reframe flow, which needs to set `reframed` directly.

## UI: Three Row States

### Display mode (default)

Current layout plus two right-aligned icon buttons:

- **Edit** — pencil SVG icon, tertiary text color at rest, accent amber on hover. `aria-label="Edit entry"`.
- **Delete** — × button, tertiary text color at rest, danger red on hover. `aria-label="Delete entry"`.

If `reframed === null` on a display-mode entry, show a small "Reframe again" link where the "Show reframed" toggle would normally sit.

### Edit mode

Triggered by clicking the Edit icon. The row body changes:

- The original paragraph is replaced by a textarea pre-filled with the current `original`, sharing the entry-form styling (surface bg, border, amber focus).
- The tag chips are replaced by the existing `TagPicker` component, pre-selected with the entry's current `tags`.
- A button row at the bottom:
  - **Save** (amber, primary) — disabled when the textarea is empty or whitespace-only.
  - **Cancel** (secondary) — discards changes, no prompt.
- Date stays visible at the top of the row.

### Delete-confirm mode

Triggered by clicking the × icon. The row body is replaced with:

- Prompt line: "Delete this entry? It can't be undone." (danger text color)
- Two buttons:
  - **Yes, delete** (danger-styled, matching the Settings "Yes, delete everything" button)
  - **Cancel** (secondary)
- Date and tag chips remain visible above the confirm strip so the user can identify the entry.

### State management

A single `activeRow: { id: string; mode: "edit" | "delete" } | null` state on the timeline component. Opening edit/delete on another row replaces `activeRow`, which effectively cancels any pending changes in the previously active row.

## Interaction Flows

### Save (edit mode)

1. Read the textarea value (trimmed) and the selected tags.
2. Compare to the entry's current `original`:
   - If text changed → call `editEntry(id, { original, tags })` (the helper also nullifies `reframed`).
   - If only tags changed → call `editEntry(id, { tags })`.
3. Refresh the entries list in App.
4. Collapse the row back to display mode.

### Cancel (edit mode) / Cancel (delete-confirm)

- Sets `activeRow` to `null`. Pending edits are discarded. No user prompt.

### Delete (confirm → Yes)

- Calls `deleteEntry(id)`.
- Refreshes the entries list.
- Row disappears from the timeline (no animation for MVP).

### Reframe again

- Only shown in display mode for entries where `reframed === null`.
- Clicking calls the existing `/api/reframe` endpoint with the current `original`, then `updateEntry(id, { reframed: result.reframed })`.
- On success, the "Reframe again" link is replaced by the normal "Show reframed" toggle.
- On failure, a small inline error message ("Could not reframe") appears next to the link, same tone as the existing reframe error on new entries.

## Component Responsibilities

- **`EntryList`** owns `activeRow` state and the handlers that open edit/delete modes.
- **`EntryList`** receives new props: `onEditEntry(id, { original, tags })`, `onDeleteEntry(id)`, `onReframeAgain(id)`.
- **`App`** implements those handlers — they call the `lib/entries.ts` helpers and refresh the in-memory `entries` state, mirroring how `handleSave` already works.
- **`TagPicker`** is reused as-is for the edit form.
- A new internal `EditEntryForm` sub-component inside `EntryList.tsx` (or a sibling file) renders the edit mode textarea + TagPicker + Save/Cancel. Keeping it close to `EntryList` is fine since it's not reused elsewhere; if the file grows too large we'll extract.

## Files Touched

- `src/lib/entries.ts` — add `deleteEntry`, `editEntry`.
- `src/lib/entries.test.ts` — cover the new helpers, including reframe-nullification semantics.
- `src/components/EntryList.tsx` — add row state machine, edit form, delete confirm, affordance buttons, "Reframe again" link.
- `src/components/EntryList.test.tsx` — cover edit, delete, reframe-again, and mutually-exclusive active row.
- `src/components/App.tsx` — wire new handlers through to `EntryList`.
- `src/components/App.test.tsx` — add mock for the new entries helpers; optionally an integration test for the edit→reframe-cleared flow.
- `e2e/entries.spec.ts` (new) — happy-path coverage for edit text, edit tags, delete, reframe again.

## Test Strategy

### Unit

- `deleteEntry` removes the matching entry; no-op on unknown id.
- `editEntry` with text change nullifies `reframed`.
- `editEntry` with tag-only change preserves `reframed`.
- `editEntry` with a text value equal to the current `original` does not nullify `reframed`.
- `editEntry` no-op on unknown id.
- `EntryList` renders Edit / Delete affordances on every row.
- Clicking Edit enters edit mode; Cancel discards; Save calls the handler with current text/tags.
- Clicking Delete shows the confirm strip; "Yes, delete" calls the handler; Cancel reverts.
- Opening edit on a second row cancels edit on the first.
- "Reframe again" link appears only when `reframed === null`; clicking it triggers the handler.

### E2E

- Edit an entry's text → timeline shows new text; "Show reframed" toggle is gone; "Reframe again" link appears.
- Edit only the tags → timeline shows new tag(s); "Show reframed" toggle still shows.
- Delete an entry → row is gone; stays gone after reload.
