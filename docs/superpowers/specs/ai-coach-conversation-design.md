# AI Coach Conversation Design

## Goal

Replace the single-shot "save → instant reframe" flow with an opt-in, multi-turn coaching conversation. The coach combines pattern-naming (hedging, luck-attribution, team-deflection) with targeted probing for missing detail (scope, audience, outcome). The user controls when to end the conversation and produce a reframed entry.

## Decisions

| Decision | Choice |
|---|---|
| Coach role | Combines pattern-naming and probing for missing detail |
| Conversation structure | Two stages: (1) feedback turns, (2) explicit "Reframe it now" click that ends the conversation and produces the reframed entry |
| Target turn count | Aim for 2-3 turns total. Not enforced in code; expressed in the system prompt |
| Trigger | Save is silent (no AI call). Each entry shows a "Talk it through with the coach" button. User clicks to opt in |
| UI surface | Inline panel that expands beneath the entry in the past-entries timeline |
| Lifespan per entry | Button is retired only once a reframe has been *offered* (i.e. the user clicked "Reframe it now"). Bailing before that leaves the button available |
| Storage | `original`, `reframed`, plus a new `coachNotes: string[]` summary. The conversation transcript itself is **not** persisted — React state only |
| Mid-conversation reload | Conversation is lost. Acceptable for MVP |
| Existing reframe flow | Replaced entirely. `/reframe` endpoint, `/api/reframe` proxy route, `reframe.py`, and the auto-reframe-after-save wiring are all deleted |
| First coach message format | Prose chat bubble + structured `notes: string[]` rendered as mono-font tag pills alongside |
| Model-driven nudge to reframe | Not added. The user controls when to reframe |
| Coach context | Includes `entry_text`, `prompt`, and `tags`. Gives the model grounding without meaningful cost |
| Streaming | Out of scope. Backlog item #13 |

## Data Model

One field added to `Entry` (in `frontend/src/lib/entries.ts` and Pydantic mirror in `backend/main.py`):

```ts
interface Entry {
  // existing fields unchanged
  coachNotes: string[] | null;
}
```

Three values for `coachNotes`, encoding the entry's coach lifecycle state:

- `null` — coach has never been offered. Talk-it-through button is shown.
- `[]` — coach was offered (user clicked "Reframe it now") but the reframe was dismissed *or* the coach genuinely had nothing to flag. Button is retired; no reframe stored.
- `["hedging", "missing-scope", ...]` — reframe was accepted. Button is retired; reframe is stored alongside the notes.

Talk-it-through button visibility reduces to a single check: `coachNotes === null`.

`reframed` keeps its current meaning: `null` when no reframe was accepted. The coach flow becomes the only writer of either field.

No migration script needed. Old entries in localStorage will read `coachNotes` as `undefined`; the data layer normalises to `null`.

## API

Two new endpoints on the Python backend, mirrored by two thin Next.js proxy routes. The existing `/reframe` endpoint and `frontend/src/app/api/reframe/route.ts` are deleted.

### `POST /coach/turn`

Returns the next coach message in an in-flight conversation.

```python
class Message(BaseModel):
    role: Literal["coach", "user"]
    text: str
    notes: list[str] = []  # only populated on coach messages

class CoachTurnRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]  # empty for the first call

class CoachTurnResponse(BaseModel):
    text: str
    notes: list[str]
```

### `POST /coach/reframe`

Returns the final reframed entry plus the consolidated `coachNotes` for the session.

```python
class CoachReframeRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]  # full back-and-forth at the moment of reframe

class CoachReframeResponse(BaseModel):
    reframed: str
    notes: list[str]  # consolidated across the whole conversation
```

### Next.js proxy routes

`frontend/src/app/api/coach/turn/route.ts` and `frontend/src/app/api/coach/reframe/route.ts` mirror the existing `generate-brag-doc` proxy pattern: 15-line passthrough to the Python service URL.

### Structured output

Both endpoints need `text + notes` shape. Use Anthropic's tool-use / JSON output to enforce, matching the approach already used by `generate_brag_doc`.

## Prompts

Two new system prompts in `backend/prompts.py`. The existing `REFRAME_SYSTEM_PROMPT` is removed.

- **`COACH_TURN_SYSTEM_PROMPT`** — defines the coach persona (combo of pattern-naming and probing for women in tech). Instructs the model to: identify hedging / luck-attribution / team-deflection / missing-scope patterns; pick the most useful next probe; keep replies short and warm; aim to wrap up within 2-3 turns; emit `notes` as a small array of kebab-case tags drawn from a fixed-ish vocabulary (e.g. `hedging`, `team-deflection`, `luck-attribution`, `missing-scope`, `missing-audience`, `missing-outcome`, `minimised-decision`).
- **`COACH_REFRAME_SYSTEM_PROMPT`** — instructs the model to produce the reframed entry given the full conversation, plus a consolidated `notes` array covering everything observed across the session. Same length / no-commentary discipline as the old `REFRAME_SYSTEM_PROMPT`.

## User Flow

1. **Write & save.** User writes an entry, picks tags, clicks **Save**. Entry is persisted to localStorage. Save ceremony plays as today (green flash, "Win logged" toast). Textarea clears. **No AI call fires.**
2. **Entry appears at top of timeline** with a single new affordance: a **Talk it through with the coach** button below the entry text.
3. **Engage the coach.** User clicks the button. Button is replaced inline by a coaching panel; the first turn is fetched (loading state: "Coach is reading...").
4. **First coach turn.** Panel renders:
   - A prose chat bubble (left-aligned).
   - A row of mono-font `coachNotes` tag pills above or alongside the bubble.
   - A reply textarea.
   - Two buttons: **Send reply** and **Reframe it now**.
5. **User replies.** User reply renders as a right-aligned bubble. Coach responds with another prose bubble (and optionally more notes). Repeat 1-2 more times.
6. **Reframe it now.** User clicks the second button at any point. The full conversation is sent to `/coach/reframe`. The reply UI is replaced in place by today's `ReframeView` component (original on left, editable reframe on right) plus a footer showing the consolidated coach notes as tag pills.
7. **Accept** → `entry.reframed` and `entry.coachNotes` are written to localStorage. Coaching panel collapses. Entry now renders in its post-coached state: original visible, "show reframed" toggle, coach-note pills near the date. Button is gone.
8. **Dismiss the reframe** → `entry.coachNotes` is written as `[]` (no `reframed` value is set). Coaching panel collapses. Button is retired by the same `coachNotes === null` rule.
9. **Bail mid-conversation** (close panel before clicking Reframe it now) → conversation is discarded; nothing is written; button stays available.

## Components

### New

- **`CoachPanel.tsx`** — inline panel that expands below an entry. Owns conversation state (`messages: Message[]`, `coachNotes: string[]`, `phase: "chatting" | "reframing" | "done"`). Renders bubbles, the reply box, the two buttons. Hands off to `ReframeView` when `phase === "reframing"`.
- **`CoachMessage.tsx`** — a single chat bubble. Variants for `coach` (left, prose + optional `notes` pills) and `user` (right, plain prose).
- **`CoachNotePills.tsx`** — small reusable component rendering `string[]` as mono-font tag pills. Used inside the conversation and on the entry meta row after acceptance. Renders nothing when given `null` or `[]`.

### Modified

- **`EntryForm.tsx`** — remove the auto-call to `/api/reframe` on save. Save becomes silent; success state stops at the toast. The `onSaved` prop signature simplifies — no reframe handoff to a parent.
- **`EntryList.tsx`** — render the **Talk it through with the coach** button on entries where `coachNotes === null`. Render `CoachNotePills` near the date when `coachNotes` is a non-empty array (empty array means coach was offered but no notes were stored — render nothing). Mount `CoachPanel` inline when the user clicks the button. Coordinates lifecycle: only one `CoachPanel` open at a time.
- **`ReframeView.tsx`** — almost unchanged. Receives a new optional `coachNotes: string[]` prop and renders them as a small footer row. Now only mounted from inside `CoachPanel`.
- **`App.tsx`** — drop the top-level reframe-after-save wiring and lifted reframe state. App just renders the journal tab; the coach lifecycle lives entirely inside `EntryList` → `CoachPanel`.

### Deleted

- `frontend/src/app/api/reframe/route.ts`
- `backend/reframe.py` and `REFRAME_SYSTEM_PROMPT` in `backend/prompts.py`
- The `/reframe` route handler in `backend/main.py`
- Reframe-after-save logic and lifted reframe state in `App.tsx` / `EntryForm.tsx`
- Existing tests covering the deleted code (replaced by new coach tests)

### Frontend API client

Wherever the existing `reframe()` function lives in `frontend/src/lib/`, replace it with two functions:

```ts
async function coachTurn(req: CoachTurnRequest): Promise<CoachTurnResponse>;
async function coachReframe(req: CoachReframeRequest): Promise<CoachReframeResponse>;
```

Same auth / error patterns as today.

## Error Handling

Save itself never depends on the AI any more, so it cannot fail on the AI path. All error handling is scoped to the coaching panel.

| Failure | Behaviour |
|---|---|
| `/coach/turn` request fails (network / 5xx) | Inline error in the panel: "Coach didn't respond. Try again." with a Retry button on the failed turn. User can also click **Reframe it now** or close the panel. The entry is untouched. |
| `/coach/reframe` request fails | Same pattern — inline error, Retry button, panel stays open. The Talk-it-through button is **not** retired (we only retire it on a successfully *offered* reframe). |
| Model returns malformed JSON / missing `notes` | Treat as transient. Same retry UX. No in-code response repair. |
| User starts typing a reply, then closes the panel | Reply is discarded silently. |
| Anthropic key missing on backend | Already handled by the existing 500 path in `main.py`; surfaces to the user as the inline error above. |

No silent fallbacks. Coaching either works or visibly didn't.

## Files Touched

### Frontend

- `frontend/src/components/CoachPanel.tsx` (new)
- `frontend/src/components/CoachPanel.test.tsx` (new)
- `frontend/src/components/CoachMessage.tsx` (new)
- `frontend/src/components/CoachMessage.test.tsx` (new)
- `frontend/src/components/CoachNotePills.tsx` (new)
- `frontend/src/components/CoachNotePills.test.tsx` (new)
- `frontend/src/components/EntryList.tsx` — add coach button + panel mounting + coachNotes rendering
- `frontend/src/components/EntryList.test.tsx` — coach button visibility, panel mounting, coachNotes rendering
- `frontend/src/components/EntryForm.tsx` — remove reframe call on save
- `frontend/src/components/EntryForm.test.tsx` — drop auto-reframe assertions
- `frontend/src/components/ReframeView.tsx` — add `coachNotes` prop + footer
- `frontend/src/components/ReframeView.test.tsx` — cover the new prop
- `frontend/src/components/App.tsx` — drop lifted reframe state
- `frontend/src/components/App.test.tsx` — drop lifted reframe assertions
- `frontend/src/lib/entries.ts` — add `coachNotes` to the `Entry` type, normalise to `null` on read
- `frontend/src/lib/entries.test.ts` — cover the normalisation
- `frontend/src/lib/api.ts` (or equivalent) — replace `reframe()` with `coachTurn()` and `coachReframe()`
- `frontend/src/app/api/coach/turn/route.ts` (new proxy)
- `frontend/src/app/api/coach/reframe/route.ts` (new proxy)
- `frontend/src/app/api/reframe/route.ts` (delete)

### Backend

- `backend/coach.py` (new) — `coach_turn()` and `coach_reframe()` functions; structured-output handling
- `backend/test_coach.py` (new) — pytest coverage for both functions
- `backend/prompts.py` — add `COACH_TURN_SYSTEM_PROMPT` and `COACH_REFRAME_SYSTEM_PROMPT`; remove `REFRAME_SYSTEM_PROMPT`
- `backend/main.py` — add `/coach/turn` and `/coach/reframe` routes; delete `/reframe` route and `ReframeRequest`/`ReframeResponse`; add `coachNotes` to the `Entry` Pydantic model
- `backend/reframe.py` (delete)
- `backend/test_reframe.py` (delete)

### E2E

- `frontend/e2e/coach.spec.ts` (new) — happy path: write entry, save, click Talk-it-through, mock Python service to return canned coach responses, send a reply, click Reframe it now, accept the reframe, assert entry shows reframed text + coach-note pills, button is gone
- `frontend/e2e/coach-error.spec.ts` (new) — coach API returns 500, assert inline error renders with Retry, entry unchanged
- `frontend/e2e/journal.spec.ts` — update: save no longer triggers any AI call

## Test Strategy

### Vitest (frontend unit / component)

- **`CoachPanel`** — opens with first turn fetched; renders coach bubble + notes; sends user reply and shows it as a user bubble; transitions to reframing phase on Reframe click; calls `coachTurn` and `coachReframe` with the right payload; surfaces errors with a Retry button; collapses on dismiss.
- **`CoachMessage`** — renders coach vs user variants; renders `notes` only on coach side; safe with empty / null notes.
- **`CoachNotePills`** — renders array as pills; renders nothing for `null` or `[]`.
- **`EntryList`** — Talk-it-through button shows when `coachNotes === null`; doesn't show after a reframe is accepted (`coachNotes` populated); doesn't show after a reframe was *offered then dismissed* (`coachNotes === []`); pills render only when `coachNotes` is a non-empty array; only one `CoachPanel` open at a time.
- **`EntryForm`** — save no longer triggers any AI call.
- **`App`** — drop lifted reframe-after-save assertions.
- **`api.ts`** — `coachTurn` and `coachReframe` mocked-fetch tests for happy path and error.

### Pytest (backend)

- **`coach_turn`** — Anthropic client mocked. Asserts that `entry_text`, `prompt`, `tags`, and the full `conversation` are passed to the model; response parses `text + notes`; error path returns 500.
- **`coach_reframe`** — same shape; asserts the full conversation is included in the model call; response parses `reframed + notes`.
- Delete `test_reframe.py`.

### Playwright (E2E)

- **`coach.spec.ts`** — happy path described above. Mocks the Python service URL.
- **`coach-error.spec.ts`** — error path with retry assertion.
- **`journal.spec.ts`** — update existing test: save no longer triggers AI.

### Test-driven order

Per the project's `superpowers:test-driven-development` discipline: each task in the implementation plan goes red → green → commit.

## Open Implementation Notes

- `frontend/AGENTS.md` flags that the local Next.js version differs from training-data defaults. Read `node_modules/next/dist/docs/` before writing the new API proxy routes and any client-component hooks.
- The design system already provides mono-font tag pills (used for entry tags) — `CoachNotePills` should reuse that primitive rather than introduce a new one.
- The design system tokens (`--color-accent`, `--color-surface`, etc.) cover everything the panel needs. No new design tokens.
