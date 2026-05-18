# Coaching Style and User Context — Design

## Goal

Let the user personalise the AI coach in two ways:

1. **Coaching style** — pick one of four pre-written voices that the coach speaks in.
2. **Career context** — a short headline and a free-text notes box describing the user's role, situation, and what's invisible in their org.

Both live in the Settings tab. Style influences the coach turn + reframe endpoints; career context influences coach turn, reframe, and brag doc generation.

The existing coaching rules (high-care/high-challenge, max 3 patterns per turn, kebab-case tags, JSON output, etc.) apply unchanged regardless of style. Personalisation changes voice and audience awareness, never the underlying coaching discipline.

## Non-goals

- No free-form coaching style ("describe your own coach"). Presets only, for v1.
- No structured career fields beyond a single headline. The textarea is where nuance lives.
- No effect on brag doc *voice*. Brag doc bullets are written for a reviewer audience and stay in a neutral professional register regardless of which coach style the user picked.
- No "reset settings" affordance. Defaults are recoverable by editing fields back to their initial values.

## User-facing changes

### Settings tab — new layout

Order, top to bottom:

1. **Coaching Style** *(new)*
2. **Your Context** *(new)*
3. **Categories** *(existing, unchanged)*
4. **Data Management** *(existing, unchanged)*

Rationale: most-permanent personalisation at the top, operational tag management below, destructive action last.

### Coaching Style card

Same surface/border treatment as existing cards. Mono uppercase header `COACHING STYLE`. Body copy: *"Pick the voice that works best for you. You can change this any time."*

A vertical stack of four selectable rows:

| Style key | Label (Fraunces 16px) | Descriptor (body-secondary) |
|---|---|---|
| `trusted-mentor` *(default)* | The Trusted Mentor | Warm, wise, unhurried. Gentle nudges. Best for women who find direct feedback triggering. |
| `hype-woman` | The Hype Woman | High energy, celebratory, zero tolerance for shrinking. Best for women who need an energy boost and respond well to enthusiasm. |
| `direct-challenger` | The Direct Challenger | High challenge, low ceremony. Cuts to the chase. Best for women who don't like the 'fluff'. |
| `bold-coach` | The Bold Coach | Playful, punchy, modern. Best for younger users or anyone who wants coaching to feel less like work. |

Selected row: amber accent border + `--color-accent-muted` background. Unselected rows: hairline border, no fill. Click on any row → selection persists immediately to localStorage. No explicit Save button.

### Your Context card

Header `YOUR CONTEXT`. Body copy: *"Helps the coach speak to where you are. None of this leaves your browser unless an entry is being reframed or a brag doc is being generated."*

Two inputs:

- **Headline** — single-line text input. Placeholder: *"e.g. Senior backend engineer at a fintech series-B"*.
- **What else should the coach know?** — multi-line textarea (~5 rows). Placeholder: *"What are you working towards? What's invisible in your org? What does your manager value?"*

Both auto-save on blur. A small mono `Saved` indicator flashes for ~1.2s on save (matching the journal-tab save ceremony at lower volume). No explicit Save button.

## Data model

A new localStorage key `confidence-journal-settings` stores:

```ts
export type CoachingStyle =
  | "trusted-mentor"
  | "hype-woman"
  | "direct-challenger"
  | "bold-coach";

export interface UserSettings {
  coachingStyle: CoachingStyle;   // default "trusted-mentor"
  contextHeadline: string;         // default ""
  contextNotes: string;            // default ""
}
```

Kept in a separate key from `confidence-journal-entries` so that "Clear all data" (entries) and personalisation are independent.

## Frontend modules

### `frontend/src/lib/settings.ts` (new)

Mirrors the shape of `entries.ts`:

- `readSettings(): UserSettings` — returns defaults when key missing or JSON corrupt; tolerant of partial blobs (any missing field falls back to default), so future fields don't break old users.
- `writeSettings(partial: Partial<UserSettings>): void` — read, merge, write.
- `serializeContext(settings: UserSettings): UserContext | null` — returns `null` when both `contextHeadline` and `contextNotes` are empty/whitespace; otherwise `{ headline, notes }`. Used by request builders.

Defaults are returned by `readSettings()` but are **not** persisted on app load. Storage is written only when the user makes an edit.

### `frontend/src/lib/coachApi.ts` (modified)

Existing request types gain two optional fields:

```ts
export interface CoachTurnRequest {
  entry_text: string;
  prompt: string;
  tags: string[];
  conversation: CoachMessage[];
  coaching_style: CoachingStyle;        // new
  user_context: UserContext | null;     // new
}

export interface CoachReframeRequest {
  // …existing fields…
  coaching_style: CoachingStyle;        // new
  user_context: UserContext | null;     // new
}

export interface UserContext {
  headline: string;
  notes: string;
}
```

The brag-doc API helper gets `user_context: UserContext | null` (no style).

Callers (`CoachPanel`, `BragDoc`) read settings via `readSettings()` at request time and serialize accordingly.

### `frontend/src/components/Settings.tsx` (modified)

Two new card sub-components added: `CoachingStyleCard` and `ContextCard`. Both bind to `readSettings()` / `writeSettings()`. Each card owns its own local component state mirroring the persisted shape, with `useEffect`-on-mount hydration.

## Backend changes

### Request schemas (`backend/main.py`)

```python
class UserContext(BaseModel):
    headline: str
    notes: str

CoachingStyle = Literal[
    "trusted-mentor", "hype-woman", "direct-challenger", "bold-coach"
]

class CoachTurnRequest(BaseModel):
    # …existing fields…
    coaching_style: CoachingStyle = "trusted-mentor"
    user_context: UserContext | None = None

class CoachReframeRequest(BaseModel):
    # …existing fields…
    coaching_style: CoachingStyle = "trusted-mentor"
    user_context: UserContext | None = None

class BragDocRequest(BaseModel):
    # …existing fields…
    user_context: UserContext | None = None
```

`Literal` validation rejects unknown style keys with HTTP 422 automatically. Defaults mean older clients (and existing tests) keep working without modification.

### Style fragments (`backend/prompts.py`)

A new `COACH_STYLE_FRAGMENTS` dict added alongside the existing system prompts:

```python
COACH_STYLE_FRAGMENTS: dict[str, str] = {
    "trusted-mentor": "Voice: warm, wise, unhurried...",
    "hype-woman":     "Voice: high energy, celebratory, zero tolerance for shrinking...",
    "direct-challenger": "Voice: high challenge, low ceremony. Cut to the chase...",
    "bold-coach":     "Voice: playful, punchy, modern...",
}
```

Each fragment is 3-5 lines describing voice only. Fragments must not override coaching rules — those live in `COACH_TURN_SYSTEM_PROMPT` and apply regardless of style.

### Prompt builder (`backend/coach.py`)

```python
def build_coach_system_prompt(
    base: str,
    style: str,
    context: UserContext | None,
) -> str:
    parts = [base, COACH_STYLE_FRAGMENTS[style]]
    if context and (context.headline.strip() or context.notes.strip()):
        parts.append(_format_user_context_block(context))
    return "\n\n".join(parts)


def _format_user_context_block(context: UserContext) -> str:
    return (
        "## About the user:\n"
        f"Headline: {context.headline.strip()}\n"
        f"Context: {context.notes.strip()}"
    )
```

`coach_turn()` and `coach_reframe()` both call `build_coach_system_prompt(...)` with the appropriate base prompt.

### Brag doc

A smaller variant `build_brag_doc_system_prompt(base, context)` appends only the "About the user" block when context is non-empty. No style fragment is applied to brag doc generation.

## Empty-context behaviour

When the frontend sends `user_context: null` (because both fields are blank/whitespace), or when both fields contain only whitespace, the "About the user" block is omitted from the composed system prompt.

For brag doc, this produces a system prompt byte-identical to today's prompt. For coach endpoints, the user's chosen style fragment is always appended (default `trusted-mentor` for users who never visit Settings) — so coach output for a default user with no context will differ slightly from today, but `trusted-mentor` is intentionally written as a near-match for the existing tone to minimise surprise.

## Testing

### Frontend unit (Vitest + RTL)

- `settings.test.ts`
  - Returns defaults when localStorage key is missing.
  - Returns defaults when stored JSON is corrupt.
  - Tolerates partial blobs (missing field → default).
  - `writeSettings` merges rather than clobbering.
  - `serializeContext` returns `null` when both fields are empty/whitespace; returns `{headline, notes}` otherwise.

- `Settings.test.tsx` (new tests)
  - Renders four style options; default selected = Trusted Mentor.
  - Clicking a different option immediately writes to settings.
  - Headline and notes inputs persist on blur.
  - `Saved` indicator appears and fades.

- `coachApi.test.ts`
  - `coachTurn` / `coachReframe` send `coaching_style` and `user_context` when caller provides them.
  - Brag-doc API helper sends `user_context` (no `coaching_style`).

### Backend unit (pytest)

- `test_coach.py`
  - System prompt sent to Anthropic contains the fragment matching the requested `coaching_style`.
  - System prompt contains the "About the user" block when `user_context` has any non-whitespace content.
  - System prompt omits the block when `user_context` is `null` or both fields are whitespace.
  - Existing tests still pass (defaulted `coaching_style` via Pydantic).
  - Invalid `coaching_style` value → 422.

- Prompt-builder tests
  - Each style key resolves to a fragment.
  - Missing context → no "About the user" block in output.
  - Whitespace-only context → no block.
  - Rules from `COACH_TURN_SYSTEM_PROMPT` are still present in the composed output (substring assertion).

### Playwright E2E

- `settings-coach.spec.ts` (new)
  - Change style from Trusted Mentor to The Hype Woman; save an entry; click "Talk it through"; assert mocked `/api/coach/turn` body contained `coaching_style: "hype-woman"`.
  - Set headline + notes; generate a brag doc; assert mocked `/api/generate-brag-doc` body contained the expected `user_context`.
  - Persistence: set style, reload, assert the chosen radio is still selected.

### What is *not* tested

- LLM output quality across styles — manual smoke test only.
- Exact prompt-string snapshots — too brittle; assertions check for substring presence of the right fragment and context block.
