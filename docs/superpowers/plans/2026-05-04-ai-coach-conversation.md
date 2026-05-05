# AI Coach Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-shot save-time reframe with an opt-in, multi-turn coaching conversation. Coach combines pattern-naming (hedging, luck-attribution, team-deflection) with probing for missing detail. User explicitly clicks "Reframe it now" to end the conversation and produce the reframed entry.

**Architecture:** Two new Python endpoints (`/coach/turn`, `/coach/reframe`) replace `/reframe`. Two thin Next.js proxy routes mirror them. Frontend gains three components: `CoachNotePills`, `CoachMessage`, `CoachPanel`. `CoachPanel` is mounted inline beneath an entry by `EntryList` when the user clicks **Talk it through with the coach**. The `Entry` type gains `coachNotes: string[] | null`. The auto-reframe wiring in `App.tsx` and `EntryForm.tsx` is removed.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind 4, Vitest + React Testing Library, Playwright. FastAPI (Python 3.12+), Anthropic SDK, pytest.

**Spec:** `docs/superpowers/specs/ai-coach-conversation-design.md`

**Git note:** The user handles all git commits manually. Each task ends with a "Stop for commit" checkpoint — do NOT run `git commit` in this plan. Stage nothing automatically.

**Working directory for all file paths:** `/Users/louiseelliot/LLMProjects/confidence-app`. Relative paths below are from the repo root.

**Next.js note:** `frontend/AGENTS.md` warns that the local Next.js version may differ from training-data defaults. Before writing the new API proxy routes (Tasks 17, 18) or any client component (Tasks 11–16), skim `frontend/node_modules/next/dist/docs/` for relevant guides on App Router route handlers and client components, especially anything about `"use client"`, `Request`/`Response`, or `NextResponse`.

---

## File Structure

### Created

- `backend/coach.py` — `coach_turn()` and `coach_reframe()` functions plus shared response parsing
- `backend/tests/test_coach.py` — pytest coverage for both endpoint routes
- `frontend/src/lib/coachApi.ts` — `coachTurn()` and `coachReframe()` client functions
- `frontend/src/lib/coachApi.test.ts`
- `frontend/src/components/CoachNotePills.tsx`
- `frontend/src/components/CoachNotePills.test.tsx`
- `frontend/src/components/CoachMessage.tsx`
- `frontend/src/components/CoachMessage.test.tsx`
- `frontend/src/components/CoachPanel.tsx`
- `frontend/src/components/CoachPanel.test.tsx`
- `frontend/src/app/api/coach/turn/route.ts`
- `frontend/src/app/api/coach/reframe/route.ts`
- `frontend/e2e/coach.spec.ts`
- `frontend/e2e/coach-error.spec.ts`

### Modified

- `backend/prompts.py` — add two new constants, remove `REFRAME_SYSTEM_PROMPT`
- `backend/main.py` — add two new endpoints, delete `/reframe` route, add `coachNotes` to `Entry`
- `frontend/src/lib/types.ts` — add `coachNotes` field
- `frontend/src/lib/entries.ts` — normalise `coachNotes` on read; allow it in `updateEntry`
- `frontend/src/lib/entries.test.ts` — cover the normalisation + new update field
- `frontend/src/components/EntryForm.tsx` — drop `saving` prop usage path; nothing else (parent owns save flow)
- `frontend/src/components/EntryForm.test.tsx` — remove the `saving` prop assertion
- `frontend/src/components/EntryList.tsx` — add Talk-it-through button + inline CoachPanel mount + coachNotes pills
- `frontend/src/components/EntryList.test.tsx` — cover new button visibility, panel mount, pills
- `frontend/src/components/ReframeView.tsx` — accept new optional `coachNotes` prop, render footer pills
- `frontend/src/components/ReframeView.test.tsx` — cover the new prop
- `frontend/src/components/App.tsx` — drop auto-reframe wiring, add `handleCoachAccept`/`handleCoachDismiss` handlers
- `frontend/src/components/App.test.tsx` — drop auto-reframe-after-save assertions, add coach-accept/dismiss assertions
- `frontend/e2e/journal.spec.ts` — remove the `/api/reframe` route stub; assert save no longer triggers any AI call

### Deleted

- `backend/reframe.py`
- `backend/tests/test_reframe.py`
- `frontend/src/app/api/reframe/route.ts`

---

## Task 1: Add coach system prompts to `backend/prompts.py`

**Files:**
- Modify: `backend/prompts.py`

- [ ] **Step 1: Read the current file**

```bash
cat backend/prompts.py
```

- [ ] **Step 2: Add the two new prompts and remove the old one**

Replace the entire contents of `backend/prompts.py` with:

```python
COACH_TURN_SYSTEM_PROMPT = (
    "You are a confidence coach for women in tech. The user has just logged a "
    "professional accomplishment. Your job is to (a) name the self-diminishing "
    "patterns you see in how they wrote about it and (b) ask one targeted question "
    "to draw out missing detail.\n\n"
    "Patterns to look for: hedging language ('just', 'kind of', 'a little'), "
    "luck-attribution ('I was lucky', 'it happened to'), team-deflection "
    "(crediting the team without naming the user's role), missing scope (no "
    "audience, no number, no outcome), minimised decisions (passive voice for "
    "calls the user actually made).\n\n"
    "Keep your message short and warm. Aim to wrap the conversation in 2-3 turns "
    "total. Pick the single most useful follow-up question; do not ask multiple.\n\n"
    "Return JSON in this exact format:\n"
    '{"text": "your prose chat message to the user", '
    '"notes": ["pattern-tag-1", "pattern-tag-2"]}\n\n'
    "Use kebab-case tags drawn from this vocabulary where they fit: "
    "hedging, team-deflection, luck-attribution, missing-scope, missing-audience, "
    "missing-outcome, minimised-decision. Add a new tag only if none of these "
    "describe what you saw. Return notes as an empty array if you observed nothing "
    "worth flagging this turn.\n\n"
    "Return only the JSON, no other text."
)

COACH_REFRAME_SYSTEM_PROMPT = (
    "You are a confidence coach for women in tech. You have just had a short "
    "conversation with the user about a professional accomplishment they logged. "
    "Now produce a reframed version of the original entry that incorporates the "
    "detail surfaced in the conversation and removes the self-diminishing patterns "
    "you observed.\n\n"
    "Preserve the facts. Remove hedging, luck-attribution, and team-deflection. "
    "Use direct, confident language. Keep approximately the same length as the "
    "original entry.\n\n"
    "Also return a consolidated list of the patterns you observed across the "
    "whole conversation, as kebab-case tags from the same vocabulary used during "
    "the conversation: hedging, team-deflection, luck-attribution, missing-scope, "
    "missing-audience, missing-outcome, minimised-decision.\n\n"
    "Return JSON in this exact format:\n"
    '{"reframed": "the reframed entry", "notes": ["pattern-tag-1", "pattern-tag-2"]}\n\n'
    "Return only the JSON, no other text."
)

BRAG_DOC_BASE_PROMPT = (
    "You are a performance review coach for women in tech. Given a list of "
    "journal entries about professional accomplishments, synthesize them into "
    "concise, impact-focused bullet points. Each bullet should be written in "
    "strong, confident language suitable for pasting into a performance "
    "self-review.\n\n"
    "Return JSON in this exact format:\n"
    '{"bullets": [{"tag": "group label", "points": ["bullet point 1", "bullet point 2"]}]}\n\n'
    "Return only the JSON, no other text."
)

GROUP_BY_CLAUSES = {
    "tag": "Group bullets by tag category. Each group's `tag` field is the tag name.",
    "month": (
        "Group bullets by calendar month based on each entry's date. Each group's "
        "`tag` field is the month label in the form 'Month YYYY' (e.g. 'April 2026'). "
        "Order groups newest-first."
    ),
    "chronological": (
        "Return a single group with the `tag` field set to an empty string. "
        "Include bullets ordered newest-first across all entries."
    ),
}
```

Note: `REFRAME_SYSTEM_PROMPT` is removed. `BRAG_DOC_BASE_PROMPT` and `GROUP_BY_CLAUSES` are unchanged.

- [ ] **Step 3: Verify nothing imports the deleted constant**

Run: `grep -rn "REFRAME_SYSTEM_PROMPT" backend/`
Expected: only matches in `backend/reframe.py` (which we will delete in Task 7) and `backend/tests/test_reframe.py` (also deleted in Task 7). No other matches.

- [ ] **Step 4: Stop for commit**

Suggested message: `feat: add coach system prompts; remove reframe prompt`

---

## Task 2: Implement `coach_turn()` in `backend/coach.py`

**Files:**
- Create: `backend/coach.py`
- Create: `backend/tests/test_coach.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_coach.py` with:

```python
import json
from unittest.mock import MagicMock


def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)]
    )


SAMPLE_TURN_BODY = {
    "entry_text": "I just helped a bit with the migration",
    "prompt": "What did you ship?",
    "tags": ["technical"],
    "conversation": [],
}


class TestCoachTurnEndpoint:
    def test_returns_text_and_notes(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "text": "Who specifically benefited?",
                    "notes": ["hedging", "missing-audience"],
                }
            ),
        )

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Who specifically benefited?"
        assert data["notes"] == ["hedging", "missing-audience"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_coach.py -v`
Expected: FAIL — endpoint not registered (404 or `app` has no route).

- [ ] **Step 3: Create `backend/coach.py` with the `coach_turn` function**

Create `backend/coach.py` with:

```python
import json
import re
from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel

from prompts import COACH_REFRAME_SYSTEM_PROMPT, COACH_TURN_SYSTEM_PROMPT

MODEL = "claude-haiku-4-5-20251001"


class Message(BaseModel):
    role: Literal["coach", "user"]
    text: str
    notes: list[str] = []


def _strip_code_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, count=1)
    text = re.sub(r"\n?```\s*$", "", text, count=1)
    return text


def _format_user_content(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
) -> str:
    header = (
        f"Daily prompt: {prompt}\n"
        f"Entry tags: {', '.join(tags) if tags else '(none)'}\n"
        f"Original entry:\n{entry_text}"
    )
    if not conversation:
        return header
    lines = [header, "", "Conversation so far:"]
    for msg in conversation:
        speaker = "Coach" if msg.role == "coach" else "User"
        lines.append(f"{speaker}: {msg.text}")
    return "\n".join(lines)


def coach_turn(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=COACH_TURN_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _format_user_content(entry_text, prompt, tags, conversation),
            }
        ],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    return json.loads(_strip_code_fences(raw))
```

- [ ] **Step 4: Wire `coach_turn` into a new route in `backend/main.py`**

Add the following to `backend/main.py`. Add the import at the top (alongside the existing `from brag_doc import ...` line):

```python
from coach import Message, coach_reframe, coach_turn
```

(Note: `coach_reframe` does not exist yet — Task 4 will add it. For now, change the import to `from coach import Message, coach_turn` and update it in Task 4.)

For Task 2, the import is:

```python
from coach import Message, coach_turn
```

Add these Pydantic request/response models *after* the existing `BragDocRequest` block:

```python
class CoachTurnRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]


class CoachTurnResponse(BaseModel):
    text: str
    notes: list[str]
```

Add this route handler *after* the existing `brag_doc_route` function:

```python
@app.post("/coach/turn", response_model=CoachTurnResponse)
def coach_turn_route(
    body: CoachTurnRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        result = coach_turn(
            entry_text=body.entry_text,
            prompt=body.prompt,
            tags=body.tags,
            conversation=body.conversation,
            client=client,
        )
    except Exception:
        logger.exception("coach turn call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach turn failed"}
        )
    return CoachTurnResponse(text=result["text"], notes=result["notes"])
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_coach.py -v`
Expected: PASS.

- [ ] **Step 6: Add the remaining `coach_turn` tests**

Append to `backend/tests/test_coach.py` inside the same `TestCoachTurnEndpoint` class:

```python
    def test_passes_entry_prompt_tags_and_conversation_to_model(
        self, mock_client, http_client
    ):
        _mock_text_response(
            mock_client, json.dumps({"text": "ok", "notes": []})
        )
        body = {
            "entry_text": "Led the migration",
            "prompt": "What did you ship?",
            "tags": ["technical", "leadership"],
            "conversation": [
                {"role": "coach", "text": "Who used it?", "notes": ["missing-audience"]},
                {"role": "user", "text": "The platform team"},
            ],
        }

        http_client.post("/coach/turn", json=body)

        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-haiku-4-5-20251001"
        assert "confidence coach for women in tech" in kwargs["system"]
        user_content = kwargs["messages"][0]["content"]
        assert "Led the migration" in user_content
        assert "What did you ship?" in user_content
        assert "technical, leadership" in user_content
        assert "Coach: Who used it?" in user_content
        assert "User: The platform team" in user_content

    def test_strips_markdown_code_fences(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            '```json\n{"text": "ok", "notes": ["hedging"]}\n```',
        )

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 200
        assert response.json()["notes"] == ["hedging"]

    def test_returns_422_when_required_fields_missing(self, mock_client, http_client):
        response = http_client.post("/coach/turn", json={"entry_text": "x"})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception("LEAKED_KEY_XYZ")

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 500
        assert response.json() == {"error": "Coach turn failed"}
        assert "LEAKED_KEY_XYZ" not in response.text
```

- [ ] **Step 7: Run all coach tests**

Run: `cd backend && uv run pytest tests/test_coach.py -v`
Expected: all 5 tests PASS.

- [ ] **Step 8: Stop for commit**

Suggested message: `feat: add /coach/turn endpoint`

---

## Task 3: Implement `coach_reframe()` in `backend/coach.py`

**Files:**
- Modify: `backend/coach.py`
- Modify: `backend/tests/test_coach.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add the failing tests**

Append to `backend/tests/test_coach.py`:

```python
SAMPLE_REFRAME_BODY = {
    "entry_text": "I just helped a bit with the migration",
    "prompt": "What did you ship?",
    "tags": ["technical"],
    "conversation": [
        {"role": "coach", "text": "Who used it?", "notes": ["missing-audience"]},
        {"role": "user", "text": "The platform team — about 40 engineers"},
    ],
}


class TestCoachReframeEndpoint:
    def test_returns_reframed_and_notes(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "reframed": "I led the migration that unblocked 40 platform engineers",
                    "notes": ["hedging", "missing-audience"],
                }
            ),
        )

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 200
        data = response.json()
        assert "40 platform engineers" in data["reframed"]
        assert data["notes"] == ["hedging", "missing-audience"]

    def test_passes_full_conversation_to_model(self, mock_client, http_client):
        _mock_text_response(
            mock_client, json.dumps({"reframed": "ok", "notes": []})
        )

        http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        user_content = mock_client.messages.create.call_args.kwargs["messages"][0][
            "content"
        ]
        assert "Coach: Who used it?" in user_content
        assert "User: The platform team — about 40 engineers" in user_content

    def test_strips_markdown_code_fences(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            '```json\n{"reframed": "ok", "notes": []}\n```',
        )

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 200
        assert response.json()["reframed"] == "ok"

    def test_returns_422_when_required_fields_missing(self, mock_client, http_client):
        response = http_client.post("/coach/reframe", json={"entry_text": "x"})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception("LEAKED_KEY_ABC")

        response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        assert response.status_code == 500
        assert response.json() == {"error": "Coach reframe failed"}
        assert "LEAKED_KEY_ABC" not in response.text

    def test_uses_reframe_system_prompt(self, mock_client, http_client):
        _mock_text_response(
            mock_client, json.dumps({"reframed": "ok", "notes": []})
        )

        http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "produce a reframed version" in system
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_coach.py::TestCoachReframeEndpoint -v`
Expected: FAIL — `/coach/reframe` route does not exist.

- [ ] **Step 3: Add `coach_reframe` to `backend/coach.py`**

Append to `backend/coach.py`:

```python
def coach_reframe(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=COACH_REFRAME_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _format_user_content(entry_text, prompt, tags, conversation),
            }
        ],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    return json.loads(_strip_code_fences(raw))
```

- [ ] **Step 4: Wire `coach_reframe` into `backend/main.py`**

Update the existing `coach` import to include `coach_reframe`:

```python
from coach import Message, coach_reframe, coach_turn
```

Add the Pydantic models *after* `CoachTurnResponse`:

```python
class CoachReframeRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]


class CoachReframeResponse(BaseModel):
    reframed: str
    notes: list[str]
```

Add the route handler *after* `coach_turn_route`:

```python
@app.post("/coach/reframe", response_model=CoachReframeResponse)
def coach_reframe_route(
    body: CoachReframeRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        result = coach_reframe(
            entry_text=body.entry_text,
            prompt=body.prompt,
            tags=body.tags,
            conversation=body.conversation,
            client=client,
        )
    except Exception:
        logger.exception("coach reframe call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach reframe failed"}
        )
    return CoachReframeResponse(reframed=result["reframed"], notes=result["notes"])
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_coach.py::TestCoachReframeEndpoint -v`
Expected: all 6 tests PASS.

- [ ] **Step 6: Run the full coach test file**

Run: `cd backend && uv run pytest tests/test_coach.py -v`
Expected: all 11 tests PASS (5 turn + 6 reframe).

- [ ] **Step 7: Stop for commit**

Suggested message: `feat: add /coach/reframe endpoint`

---

## Task 4: Add `coachNotes` to backend `Entry` model

**Files:**
- Modify: `backend/main.py`

The brag-doc endpoint receives `Entry` objects from the frontend. Once the frontend sends `coachNotes`, Pydantic will reject the request unless the model knows about the field.

- [ ] **Step 1: Add `coachNotes` to the `Entry` Pydantic model**

In `backend/main.py`, modify the `Entry` class definition to add the new field:

```python
class Entry(BaseModel):
    id: str
    date: str
    prompt: str
    original: str
    reframed: str | None = None
    tags: list[str]
    createdAt: str
    coachNotes: list[str] | None = None
```

- [ ] **Step 2: Verify existing brag-doc tests still pass**

Run: `cd backend && uv run pytest tests/test_brag_doc.py -v`
Expected: all PASS. The existing fixtures don't include `coachNotes`; defaulting to `None` keeps them valid.

- [ ] **Step 3: Stop for commit**

Suggested message: `feat: accept coachNotes on Entry model`

---

## Task 5: Delete the old reframe path

**Files:**
- Delete: `backend/reframe.py`
- Delete: `backend/tests/test_reframe.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Delete `backend/reframe.py`**

Run: `rm backend/reframe.py`

- [ ] **Step 2: Delete `backend/tests/test_reframe.py`**

Run: `rm backend/tests/test_reframe.py`

- [ ] **Step 3: Remove the `/reframe` route and its imports from `backend/main.py`**

In `backend/main.py`:

Remove the import:
```python
from reframe import reframe
```

Remove the request/response models:
```python
class ReframeRequest(BaseModel):
    text: str


class ReframeResponse(BaseModel):
    reframed: str
```

Remove the entire `reframe_route` function (the `@app.post("/reframe", ...)` block and everything inside it).

- [ ] **Step 4: Verify backend tests still pass**

Run: `cd backend && uv run pytest -v`
Expected: all tests PASS — `test_health.py`, `test_coach.py`, `test_brag_doc.py`. No `test_reframe.py` collected.

- [ ] **Step 5: Verify no stale references**

Run: `grep -rn "reframe_route\|ReframeRequest\|ReframeResponse\|REFRAME_SYSTEM_PROMPT" backend/`
Expected: no matches.

Run: `grep -rn "from reframe import" backend/`
Expected: no matches.

- [ ] **Step 6: Stop for commit**

Suggested message: `refactor: remove old /reframe endpoint and module`

---

## Task 6: Add `coachNotes` to the frontend `Entry` type

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Step 1: Add the new field**

Replace the contents of `frontend/src/lib/types.ts` with:

```typescript
export interface Entry {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  createdAt: string;
  coachNotes: string[] | null;
}
```

- [ ] **Step 2: Verify TypeScript surfaces the gap**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors in places that construct `Entry` objects without `coachNotes` (notably `addEntry` callers in `App.tsx` and tests). These are wired in subsequent tasks. Note them but do not fix yet — the next tasks address each callsite.

- [ ] **Step 3: Stop for commit**

Suggested message: `feat: add coachNotes to Entry type`

---

## Task 7: Update `entries.ts` to handle `coachNotes`

**Files:**
- Modify: `frontend/src/lib/entries.ts`
- Modify: `frontend/src/lib/entries.test.ts`

The data layer needs to (a) normalise `coachNotes` to `null` when reading entries that pre-date the field and (b) allow `updateEntry` to set `coachNotes`.

- [ ] **Step 1: Write the failing tests**

Append the following tests to `frontend/src/lib/entries.test.ts` (inside any existing `describe` block at the top level of the file, or in a new `describe("coachNotes", ...)`):

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { addEntry, getEntries, updateEntry } from "./entries";

describe("coachNotes handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalises a missing coachNotes field to null when reading", () => {
    // Simulate an entry written before coachNotes existed.
    const legacy = [
      {
        id: "1",
        date: "2026-04-01",
        prompt: "What impact?",
        original: "Did a thing",
        reframed: null,
        tags: [],
        createdAt: "2026-04-01T18:00:00Z",
      },
    ];
    localStorage.setItem(
      "confidence-journal-entries",
      JSON.stringify(legacy)
    );

    const entries = getEntries();

    expect(entries[0].coachNotes).toBeNull();
  });

  it("addEntry persists coachNotes when provided", () => {
    addEntry({
      date: "2026-05-01",
      prompt: "What impact?",
      original: "Led the rollout",
      reframed: null,
      tags: ["leadership"],
      coachNotes: ["hedging"],
    });

    expect(getEntries()[0].coachNotes).toEqual(["hedging"]);
  });

  it("updateEntry can set coachNotes to an empty array", () => {
    const entry = addEntry({
      date: "2026-05-01",
      prompt: "What?",
      original: "x",
      reframed: null,
      tags: [],
      coachNotes: null,
    });

    updateEntry(entry.id, { coachNotes: [] });

    expect(getEntries()[0].coachNotes).toEqual([]);
  });

  it("updateEntry can set both reframed and coachNotes atomically", () => {
    const entry = addEntry({
      date: "2026-05-01",
      prompt: "What?",
      original: "x",
      reframed: null,
      tags: [],
      coachNotes: null,
    });

    updateEntry(entry.id, {
      reframed: "X (reframed)",
      coachNotes: ["hedging", "missing-scope"],
    });

    const result = getEntries()[0];
    expect(result.reframed).toBe("X (reframed)");
    expect(result.coachNotes).toEqual(["hedging", "missing-scope"]);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts`
Expected: the four new tests FAIL — `addEntry` rejects the `coachNotes` field at the type level (or at runtime), `updateEntry` rejects it, and the legacy-entries test gets `undefined` instead of `null`.

- [ ] **Step 3: Update `entries.ts` to support `coachNotes`**

Modify `frontend/src/lib/entries.ts`:

- Update the `readEntries` function to normalise the field on read:

```typescript
function readEntries(): Entry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) => ({
      ...e,
      coachNotes: e.coachNotes ?? null,
    }));
  } catch {
    return [];
  }
}
```

- Update `updateEntry` to allow `coachNotes`:

```typescript
export function updateEntry(
  id: string,
  updates: Partial<Pick<Entry, "original" | "reframed" | "tags" | "coachNotes">>
): void {
  const entries = readEntries();
  const index = entries.findIndex((e) => e.id === id);
  if (index !== -1) {
    entries[index] = { ...entries[index], ...updates };
    writeEntries(entries);
  }
}
```

- `addEntry` does **not** need a code change — its signature `Omit<Entry, "id" | "createdAt">` automatically picks up the new field once `Entry` includes it. Callers must now pass `coachNotes` when adding an entry; the next task updates the only such caller (`App.tsx`).

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Stop for commit**

Suggested message: `feat: read and write coachNotes in entries data layer`

---

## Task 8: Add the coach API client (`coachApi.ts`)

**Files:**
- Create: `frontend/src/lib/coachApi.ts`
- Create: `frontend/src/lib/coachApi.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/coachApi.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { coachTurn, coachReframe, type CoachMessage } from "./coachApi";

const sampleArgs = {
  entry_text: "Led the rollout",
  prompt: "What did you ship?",
  tags: ["leadership"],
  conversation: [] as CoachMessage[],
};

describe("coachApi", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("coachTurn POSTs to /api/coach/turn and returns parsed JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ text: "Who benefited?", notes: ["missing-audience"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await coachTurn(sampleArgs);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/coach/turn",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleArgs),
      })
    );
    expect(result).toEqual({ text: "Who benefited?", notes: ["missing-audience"] });
  });

  it("coachTurn throws when the response is not ok", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 })
    );

    await expect(coachTurn(sampleArgs)).rejects.toThrow();
  });

  it("coachReframe POSTs to /api/coach/reframe and returns parsed JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ reframed: "Led the rollout for 40 engineers", notes: ["hedging"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await coachReframe(sampleArgs);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/coach/reframe",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleArgs),
      })
    );
    expect(result).toEqual({
      reframed: "Led the rollout for 40 engineers",
      notes: ["hedging"],
    });
  });

  it("coachReframe throws when the response is not ok", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 })
    );

    await expect(coachReframe(sampleArgs)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/coachApi.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `frontend/src/lib/coachApi.ts`**

```typescript
export interface CoachMessage {
  role: "coach" | "user";
  text: string;
  notes?: string[];
}

export interface CoachTurnRequest {
  entry_text: string;
  prompt: string;
  tags: string[];
  conversation: CoachMessage[];
}

export interface CoachTurnResponse {
  text: string;
  notes: string[];
}

export interface CoachReframeRequest {
  entry_text: string;
  prompt: string;
  tags: string[];
  conversation: CoachMessage[];
}

export interface CoachReframeResponse {
  reframed: string;
  notes: string[];
}

async function postJson<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed with status ${response.status}`);
  }
  return response.json() as Promise<TRes>;
}

export function coachTurn(req: CoachTurnRequest): Promise<CoachTurnResponse> {
  return postJson<CoachTurnRequest, CoachTurnResponse>("/api/coach/turn", req);
}

export function coachReframe(
  req: CoachReframeRequest
): Promise<CoachReframeResponse> {
  return postJson<CoachReframeRequest, CoachReframeResponse>(
    "/api/coach/reframe",
    req
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/coachApi.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Stop for commit**

Suggested message: `feat: add coach API client`

---

## Task 9: Build `CoachNotePills` component

**Files:**
- Create: `frontend/src/components/CoachNotePills.tsx`
- Create: `frontend/src/components/CoachNotePills.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/CoachNotePills.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachNotePills } from "./CoachNotePills";

describe("CoachNotePills", () => {
  it("renders a pill for each note", () => {
    render(<CoachNotePills notes={["hedging", "missing-scope"]} />);
    expect(screen.getByText("hedging")).toBeInTheDocument();
    expect(screen.getByText("missing-scope")).toBeInTheDocument();
  });

  it("renders nothing when notes is null", () => {
    const { container } = render(<CoachNotePills notes={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when notes is an empty array", () => {
    const { container } = render(<CoachNotePills notes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CoachNotePills.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `frontend/src/components/CoachNotePills.tsx`**

```tsx
interface CoachNotePillsProps {
  notes: string[] | null;
}

export function CoachNotePills({ notes }: CoachNotePillsProps) {
  if (!notes || notes.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
      }}
    >
      {notes.map((note) => (
        <span
          key={note}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-accent-muted)",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent-border)",
          }}
        >
          {note}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/CoachNotePills.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 5: Stop for commit**

Suggested message: `feat: add CoachNotePills component`

---

## Task 10: Build `CoachMessage` component

**Files:**
- Create: `frontend/src/components/CoachMessage.tsx`
- Create: `frontend/src/components/CoachMessage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/CoachMessage.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachMessage } from "./CoachMessage";

describe("CoachMessage", () => {
  it("renders coach text in a coach bubble with role label", () => {
    render(<CoachMessage role="coach" text="Who benefited?" />);
    expect(screen.getByText("Who benefited?")).toBeInTheDocument();
    expect(screen.getByText(/coach/i)).toBeInTheDocument();
  });

  it("renders coach notes as pills when provided", () => {
    render(
      <CoachMessage
        role="coach"
        text="Who benefited?"
        notes={["hedging", "missing-audience"]}
      />
    );
    expect(screen.getByText("hedging")).toBeInTheDocument();
    expect(screen.getByText("missing-audience")).toBeInTheDocument();
  });

  it("does not render notes for user messages", () => {
    render(<CoachMessage role="user" text="The platform team" notes={["hedging"]} />);
    expect(screen.queryByText("hedging")).not.toBeInTheDocument();
  });

  it("renders user text in a user bubble with role label", () => {
    render(<CoachMessage role="user" text="The platform team" />);
    expect(screen.getByText("The platform team")).toBeInTheDocument();
    expect(screen.getByText(/you/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CoachMessage.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `frontend/src/components/CoachMessage.tsx`**

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isCoach ? "flex-start" : "flex-end",
        gap: "6px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isCoach ? "var(--color-accent)" : "var(--color-text-tertiary)",
        }}
      >
        {isCoach ? "Coach" : "You"}
      </span>
      {isCoach && notes && notes.length > 0 && <CoachNotePills notes={notes} />}
      <p
        style={{
          fontSize: "14px",
          lineHeight: 1.6,
          color: isCoach
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          background: isCoach
            ? "var(--color-surface)"
            : "var(--color-surface-raised)",
          border: isCoach
            ? "1px solid var(--color-accent-border)"
            : "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          margin: 0,
          maxWidth: "85%",
        }}
      >
        {text}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/CoachMessage.test.tsx`
Expected: all 4 tests PASS.

- [ ] **Step 5: Stop for commit**

Suggested message: `feat: add CoachMessage component`

---

## Task 11: Build `CoachPanel` component (chatting phase)

**Files:**
- Create: `frontend/src/components/CoachPanel.tsx`
- Create: `frontend/src/components/CoachPanel.test.tsx`

This task covers the chat-only behaviour. The reframing handoff is added in Task 12.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/CoachPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoachPanel } from "./CoachPanel";
import * as coachApi from "@/lib/coachApi";

const baseEntry = {
  id: "e1",
  original: "I just helped a bit with the migration",
  prompt: "What did you ship?",
  tags: ["technical"],
};

describe("CoachPanel — chatting phase", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the first coach turn on mount and renders it", async () => {
    const turn = vi
      .spyOn(coachApi, "coachTurn")
      .mockResolvedValueOnce({
        text: "Who benefited from the migration?",
        notes: ["missing-audience"],
      });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByText("Who benefited from the migration?")
      ).toBeInTheDocument()
    );
    expect(screen.getByText("missing-audience")).toBeInTheDocument();
    expect(turn).toHaveBeenCalledWith({
      entry_text: baseEntry.original,
      prompt: baseEntry.prompt,
      tags: baseEntry.tags,
      conversation: [],
    });
  });

  it("sends the user's reply and renders the next coach turn", async () => {
    vi.spyOn(coachApi, "coachTurn")
      .mockResolvedValueOnce({ text: "Who benefited?", notes: ["missing-audience"] })
      .mockResolvedValueOnce({ text: "What did it unblock for them?", notes: [] });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Who benefited?");
    await userEvent.type(
      screen.getByLabelText(/your reply/i),
      "The platform team"
    );
    await userEvent.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText("The platform team")).toBeInTheDocument();
    expect(
      await screen.findByText("What did it unblock for them?")
    ).toBeInTheDocument();
  });

  it("shows a retry button when the first turn fails", async () => {
    vi.spyOn(coachApi, "coachTurn").mockRejectedValueOnce(new Error("network"));

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByText(/coach didn['']t respond/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onClose when the user closes the panel before reframe", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    const onClose = vi.fn();

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={onClose}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CoachPanel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `frontend/src/components/CoachPanel.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CoachMessage } from "./CoachMessage";
import { coachTurn, type CoachMessage as ApiMessage } from "@/lib/coachApi";

export interface CoachPanelEntry {
  id: string;
  original: string;
  prompt: string;
  tags: string[];
}

interface CoachPanelProps {
  entry: CoachPanelEntry;
  onAccept: (reframed: string, notes: string[]) => void;
  onDismiss: () => void;
  onClose: () => void;
}

type Phase =
  | { kind: "loading-turn" }
  | { kind: "chatting" }
  | { kind: "error-turn" };

export function CoachPanel({
  entry,
  onAccept: _onAccept,
  onDismiss: _onDismiss,
  onClose,
}: CoachPanelProps) {
  // _onAccept and _onDismiss are wired in Task 12.
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading-turn" });
  const [reply, setReply] = useState("");
  const fetchedFirstRef = useRef(false);

  async function fetchTurn(history: ApiMessage[]) {
    setPhase({ kind: "loading-turn" });
    try {
      const result = await coachTurn({
        entry_text: entry.original,
        prompt: entry.prompt,
        tags: entry.tags,
        conversation: history,
      });
      setMessages([
        ...history,
        { role: "coach", text: result.text, notes: result.notes },
      ]);
      setPhase({ kind: "chatting" });
    } catch {
      setPhase({ kind: "error-turn" });
    }
  }

  useEffect(() => {
    if (fetchedFirstRef.current) return;
    fetchedFirstRef.current = true;
    void fetchTurn([]);
    // We intentionally only run this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSendReply() {
    const trimmed = reply.trim();
    if (!trimmed) return;
    const next: ApiMessage[] = [
      ...messages,
      { role: "user", text: trimmed },
    ];
    setMessages(next);
    setReply("");
    void fetchTurn(next);
  }

  function handleRetry() {
    void fetchTurn(messages);
  }

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "16px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-accent-border)",
        borderRadius: "var(--radius-md)",
        animation: "fadeIn 0.25s ease both",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
          }}
        >
          AI Coach
        </span>
        <button
          type="button"
          aria-label="Close coach"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
          }}
        >
          Close
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        {messages.map((m, i) => (
          <CoachMessage key={i} role={m.role} text={m.text} notes={m.notes} />
        ))}

        {phase.kind === "loading-turn" && (
          <p
            role="status"
            aria-live="polite"
            style={{
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            Coach is reading...
          </p>
        )}

        {phase.kind === "error-turn" && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "13px",
              color: "var(--color-danger)",
            }}
          >
            <span>Coach didn&apos;t respond. Try again.</span>
            <button
              type="button"
              onClick={handleRetry}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-accent)",
                background: "none",
                border: "1px solid var(--color-accent-border)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {phase.kind === "chatting" && (
        <div style={{ marginTop: "16px" }}>
          <label
            htmlFor={`coach-reply-${entry.id}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              display: "block",
              marginBottom: "8px",
            }}
          >
            Your reply
          </label>
          <textarea
            id={`coach-reply-${entry.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              background: "var(--color-base)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={!reply.trim()}
              style={{
                padding: "8px 18px",
                background: "var(--color-surface-raised)",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                cursor: reply.trim() ? "pointer" : "not-allowed",
                opacity: reply.trim() ? 1 : 0.5,
              }}
            >
              Send reply
            </button>
            <button
              type="button"
              data-testid="reframe-now"
              disabled
              style={{
                padding: "8px 18px",
                background: "var(--color-accent)",
                color: "var(--color-base)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                opacity: 0.4,
              }}
            >
              Reframe it now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: the **Reframe it now** button is disabled and inert in this task — it becomes interactive in Task 12. The `onAccept` and `onDismiss` props are accepted but unused; the underscore-prefix in the destructuring tells ESLint they are intentionally unused for now. Task 12 wires them in.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/CoachPanel.test.tsx`
Expected: all 4 tests PASS.

- [ ] **Step 5: Stop for commit**

Suggested message: `feat: add CoachPanel chatting phase`

---

## Task 12: Add the reframing phase to `CoachPanel`

**Files:**
- Modify: `frontend/src/components/CoachPanel.tsx`
- Modify: `frontend/src/components/CoachPanel.test.tsx`
- Modify: `frontend/src/components/ReframeView.tsx`
- Modify: `frontend/src/components/ReframeView.test.tsx`

`CoachPanel` needs to: call `coachReframe`, show `ReframeView` with the result, wire its Accept and Dismiss buttons through to the `onAccept` / `onDismiss` props.

`ReframeView` needs to accept and render an optional `coachNotes` footer.

- [ ] **Step 1: Add `coachNotes` prop to `ReframeView` (TDD)**

Append to `frontend/src/components/ReframeView.test.tsx` inside the `describe("ReframeView", ...)`:

```tsx
  it("renders coach notes as pills in a footer when provided", () => {
    render(
      <ReframeView
        {...props}
        coachNotes={["hedging", "missing-audience"]}
      />
    );
    expect(screen.getByText("hedging")).toBeInTheDocument();
    expect(screen.getByText("missing-audience")).toBeInTheDocument();
  });

  it("does not render the coach-notes footer when coachNotes is omitted", () => {
    render(<ReframeView {...props} />);
    // Use the absence of any pill text to assert the footer didn't render.
    expect(screen.queryByText("hedging")).not.toBeInTheDocument();
  });
```

Run: `cd frontend && npx vitest run src/components/ReframeView.test.tsx`
Expected: the new tests FAIL.

In `frontend/src/components/ReframeView.tsx`:

- Add the import at the top:

```tsx
import { CoachNotePills } from "./CoachNotePills";
```

- Update the `ReframeViewProps` interface to add the optional prop:

```tsx
interface ReframeViewProps {
  original: string;
  reframed: string;
  onAccept: (finalText: string) => void;
  onDismiss: () => void;
  coachNotes?: string[] | null;
}
```

- Update the function signature to destructure it:

```tsx
export function ReframeView({
  original,
  reframed,
  onAccept,
  onDismiss,
  coachNotes,
}: ReframeViewProps) {
```

- Add a footer section just before the closing `</div>` of the outermost `<div>` (after the existing button row):

```tsx
      {coachNotes && coachNotes.length > 0 && (
        <div
          style={{
            padding: "0 24px 20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderTop: "1px solid var(--color-border-subtle)",
            paddingTop: "16px",
            marginTop: "-4px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            What the coach noticed
          </span>
          <CoachNotePills notes={coachNotes} />
        </div>
      )}
```

Run: `cd frontend && npx vitest run src/components/ReframeView.test.tsx`
Expected: all tests PASS.

- [ ] **Step 2: Add the failing reframe-phase tests to `CoachPanel.test.tsx`**

Append to `frontend/src/components/CoachPanel.test.tsx`:

```tsx
import * as coachApiAlias from "@/lib/coachApi";

describe("CoachPanel — reframing phase", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls coachReframe with the full conversation when Reframe it now is clicked", async () => {
    vi.spyOn(coachApiAlias, "coachTurn").mockResolvedValueOnce({
      text: "Who benefited?",
      notes: ["missing-audience"],
    });
    const reframeSpy = vi
      .spyOn(coachApiAlias, "coachReframe")
      .mockResolvedValueOnce({ reframed: "Polished version", notes: ["hedging"] });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Who benefited?");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));

    await waitFor(() => expect(reframeSpy).toHaveBeenCalled());
    expect(reframeSpy.mock.calls[0][0]).toMatchObject({
      entry_text: baseEntry.original,
      conversation: [
        expect.objectContaining({ role: "coach", text: "Who benefited?" }),
      ],
    });
  });

  it("renders ReframeView with reframed text and notes after reframe completes", async () => {
    vi.spyOn(coachApiAlias, "coachTurn").mockResolvedValueOnce({
      text: "Who benefited?",
      notes: [],
    });
    vi.spyOn(coachApiAlias, "coachReframe").mockResolvedValueOnce({
      reframed: "Led the migration that unblocked 40 engineers",
      notes: ["hedging", "missing-audience"],
    });

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Who benefited?");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));

    expect(
      await screen.findByDisplayValue(
        "Led the migration that unblocked 40 engineers"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("hedging")).toBeInTheDocument();
  });

  it("calls onAccept with the (possibly edited) reframed text and notes when Accept is clicked", async () => {
    vi.spyOn(coachApiAlias, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    vi.spyOn(coachApiAlias, "coachReframe").mockResolvedValueOnce({
      reframed: "Polished",
      notes: ["hedging"],
    });
    const onAccept = vi.fn();

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={onAccept}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));
    await screen.findByDisplayValue("Polished");
    await userEvent.click(screen.getByRole("button", { name: /^accept$/i }));

    expect(onAccept).toHaveBeenCalledWith("Polished", ["hedging"]);
  });

  it("calls onDismiss when Dismiss is clicked on the reframe view", async () => {
    vi.spyOn(coachApiAlias, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    vi.spyOn(coachApiAlias, "coachReframe").mockResolvedValueOnce({
      reframed: "Polished",
      notes: [],
    });
    const onDismiss = vi.fn();

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));
    await screen.findByDisplayValue("Polished");
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it("shows a retry button when the reframe call fails", async () => {
    vi.spyOn(coachApiAlias, "coachTurn").mockResolvedValueOnce({
      text: "Hi",
      notes: [],
    });
    vi.spyOn(coachApiAlias, "coachReframe").mockRejectedValueOnce(new Error("boom"));

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: /reframe it now/i }));

    expect(
      await screen.findByText(/coach didn['']t respond/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npx vitest run src/components/CoachPanel.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 3: Update `CoachPanel.tsx` to handle the reframing phase**

Replace the entire contents of `frontend/src/components/CoachPanel.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CoachMessage } from "./CoachMessage";
import { ReframeView } from "./ReframeView";
import {
  coachReframe,
  coachTurn,
  type CoachMessage as ApiMessage,
} from "@/lib/coachApi";

export interface CoachPanelEntry {
  id: string;
  original: string;
  prompt: string;
  tags: string[];
}

interface CoachPanelProps {
  entry: CoachPanelEntry;
  onAccept: (reframed: string, notes: string[]) => void;
  onDismiss: () => void;
  onClose: () => void;
}

type Phase =
  | { kind: "loading-turn" }
  | { kind: "chatting" }
  | { kind: "error-turn" }
  | { kind: "loading-reframe" }
  | { kind: "reframing"; reframed: string; notes: string[] }
  | { kind: "error-reframe" };

export function CoachPanel({
  entry,
  onAccept,
  onDismiss,
  onClose,
}: CoachPanelProps) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading-turn" });
  const [reply, setReply] = useState("");
  const fetchedFirstRef = useRef(false);

  async function fetchTurn(history: ApiMessage[]) {
    setPhase({ kind: "loading-turn" });
    try {
      const result = await coachTurn({
        entry_text: entry.original,
        prompt: entry.prompt,
        tags: entry.tags,
        conversation: history,
      });
      setMessages([
        ...history,
        { role: "coach", text: result.text, notes: result.notes },
      ]);
      setPhase({ kind: "chatting" });
    } catch {
      setPhase({ kind: "error-turn" });
    }
  }

  async function fetchReframe() {
    setPhase({ kind: "loading-reframe" });
    try {
      const result = await coachReframe({
        entry_text: entry.original,
        prompt: entry.prompt,
        tags: entry.tags,
        conversation: messages,
      });
      setPhase({
        kind: "reframing",
        reframed: result.reframed,
        notes: result.notes,
      });
    } catch {
      setPhase({ kind: "error-reframe" });
    }
  }

  useEffect(() => {
    if (fetchedFirstRef.current) return;
    fetchedFirstRef.current = true;
    void fetchTurn([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSendReply() {
    const trimmed = reply.trim();
    if (!trimmed) return;
    const next: ApiMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setReply("");
    void fetchTurn(next);
  }

  function handleRetryTurn() {
    void fetchTurn(messages);
  }

  function handleRetryReframe() {
    void fetchReframe();
  }

  function handleAccept(finalText: string) {
    if (phase.kind !== "reframing") return;
    onAccept(finalText, phase.notes);
  }

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "16px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-accent-border)",
        borderRadius: "var(--radius-md)",
        animation: "fadeIn 0.25s ease both",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
          }}
        >
          AI Coach
        </span>
        {phase.kind !== "reframing" && (
          <button
            type="button"
            aria-label="Close coach"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            Close
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        {messages.map((m, i) => (
          <CoachMessage key={i} role={m.role} text={m.text} notes={m.notes} />
        ))}

        {phase.kind === "loading-turn" && (
          <p
            role="status"
            aria-live="polite"
            style={{
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            Coach is reading...
          </p>
        )}

        {phase.kind === "loading-reframe" && (
          <p
            role="status"
            aria-live="polite"
            style={{
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
            }}
          >
            Coach is rewriting...
          </p>
        )}

        {phase.kind === "error-turn" && (
          <ErrorRow
            onRetry={handleRetryTurn}
          />
        )}

        {phase.kind === "error-reframe" && (
          <ErrorRow
            onRetry={handleRetryReframe}
          />
        )}
      </div>

      {phase.kind === "chatting" && (
        <div style={{ marginTop: "16px" }}>
          <label
            htmlFor={`coach-reply-${entry.id}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              display: "block",
              marginBottom: "8px",
            }}
          >
            Your reply
          </label>
          <textarea
            id={`coach-reply-${entry.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              background: "var(--color-base)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={!reply.trim()}
              style={{
                padding: "8px 18px",
                background: "var(--color-surface-raised)",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                cursor: reply.trim() ? "pointer" : "not-allowed",
                opacity: reply.trim() ? 1 : 0.5,
              }}
            >
              Send reply
            </button>
            <button
              type="button"
              onClick={() => void fetchReframe()}
              style={{
                padding: "8px 18px",
                background: "var(--color-accent)",
                color: "var(--color-base)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Reframe it now
            </button>
          </div>
        </div>
      )}

      {phase.kind === "reframing" && (
        <div style={{ marginTop: "16px" }}>
          <ReframeView
            original={entry.original}
            reframed={phase.reframed}
            coachNotes={phase.notes}
            onAccept={handleAccept}
            onDismiss={onDismiss}
          />
        </div>
      )}
    </div>
  );
}

interface ErrorRowProps {
  onRetry: () => void;
}

function ErrorRow({ onRetry }: ErrorRowProps) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "13px",
        color: "var(--color-danger)",
      }}
    >
      <span>Coach didn&apos;t respond. Try again.</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--color-accent)",
          background: "none",
          border: "1px solid var(--color-accent-border)",
          borderRadius: "var(--radius-sm)",
          padding: "4px 10px",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run all `CoachPanel` tests**

Run: `cd frontend && npx vitest run src/components/CoachPanel.test.tsx`
Expected: all 9 tests PASS (4 from Task 11 + 5 new).

- [ ] **Step 5: Run `ReframeView` tests**

Run: `cd frontend && npx vitest run src/components/ReframeView.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Stop for commit**

Suggested message: `feat: add reframing phase to CoachPanel`

---

## Task 13: Add the Next.js proxy routes for the coach endpoints

**Files:**
- Create: `frontend/src/app/api/coach/turn/route.ts`
- Create: `frontend/src/app/api/coach/reframe/route.ts`

These mirror the existing `generate-brag-doc` proxy: thin pass-through to the Python service.

- [ ] **Step 1: Verify the route directory does not yet exist**

Run: `ls frontend/src/app/api/coach 2>/dev/null || echo "absent"`
Expected: `absent`.

- [ ] **Step 2: Create the directory and `turn/route.ts`**

Run: `mkdir -p frontend/src/app/api/coach/turn frontend/src/app/api/coach/reframe`

Create `frontend/src/app/api/coach/turn/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
  const body = await request.text();
  try {
    const upstream = await fetch(`${pythonUrl}/coach/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("coach turn proxy failed to reach Python service", error);
    return NextResponse.json(
      { error: "Coach turn failed" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 3: Create `reframe/route.ts`**

Create `frontend/src/app/api/coach/reframe/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
  const body = await request.text();
  try {
    const upstream = await fetch(`${pythonUrl}/coach/reframe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("coach reframe proxy failed to reach Python service", error);
    return NextResponse.json(
      { error: "Coach reframe failed" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 4: Verify build still works**

Run: `cd frontend && npm run build`
Expected: build succeeds; output mentions both new routes.

- [ ] **Step 5: Stop for commit**

Suggested message: `feat: add Next.js proxy routes for coach endpoints`

---

## Task 14: Delete the old `/api/reframe` proxy route

**Files:**
- Delete: `frontend/src/app/api/reframe/route.ts` (and the `reframe` directory)

- [ ] **Step 1: Confirm nothing on the frontend still calls `/api/reframe`**

Run: `grep -rn "/api/reframe" frontend/src`
Expected: only matches in the file we are about to delete (and possibly in components or App.tsx that will be updated in Task 16). Note them for Task 16.

Run: `grep -rn "/api/reframe" frontend/e2e`
Expected: matches in `journal.spec.ts` — handled in Task 18.

- [ ] **Step 2: Delete the route**

Run: `rm -r frontend/src/app/api/reframe`

- [ ] **Step 3: Verify build does not regress (it will until Task 16 lands the App.tsx change — that's expected for now)**

Skip the build check; the next task fixes the now-broken App.tsx callsite.

- [ ] **Step 4: Stop for commit**

Suggested message: `chore: remove old /api/reframe proxy route`

---

## Task 15: Strip auto-reframe-on-save from `App.tsx` and clean up `EntryForm`

**Files:**
- Modify: `frontend/src/components/App.tsx`
- Modify: `frontend/src/components/App.test.tsx`
- Modify: `frontend/src/components/EntryForm.tsx`
- Modify: `frontend/src/components/EntryForm.test.tsx`

`App.tsx` currently fetches `/api/reframe` after save and renders a top-level `<ReframeView>`. All of that goes. The new coach lifecycle is owned by `EntryList` → `CoachPanel` (wired in Task 16).

`EntryForm` has a `saving` prop that disables the Save button while the parent's reframe call is in flight. With auto-reframe gone, the prop is no longer needed.

- [ ] **Step 1: Update `App.test.tsx` to drop the auto-reframe-after-save assertions**

Open `frontend/src/components/App.test.tsx`. Find any test that mocks `/api/reframe` or asserts that `ReframeView` appears after a save, and delete those tests. Specifically, remove any test whose body posts a save and then expects:

- a `Reframing your entry...` status, OR
- a `ReframeView` to appear, OR
- the textarea to be replaced by a side-by-side reframe.

Tests for "saving an entry persists it" and tab switching should remain.

Note: This step is intentionally surgical — the engineer should read the file and delete only those specific tests. If unclear, run the file and look for tests that fail in Step 4 below; those are the ones to remove.

- [ ] **Step 2: Strip the auto-reframe code from `App.tsx`**

Open `frontend/src/components/App.tsx` and:

- Remove the `ReframeView` import:

```diff
- import { ReframeView } from "./ReframeView";
```

- Remove the reframing-related state declarations:

```diff
-  const [reframing, setReframing] = useState<{
-    entryId: string;
-    original: string;
-    reframed: string;
-  } | null>(null);
-  const [reframeLoading, setReframeLoading] = useState(false);
-  const [reframeError, setReframeError] = useState<string | null>(null);
```

- Replace the entire `handleSave` function with a synchronous version that just persists the entry:

```typescript
function handleSave(data: { original: string; tags: string[] }) {
  addEntry({
    date: today,
    prompt,
    original: data.original,
    reframed: null,
    tags: data.tags,
    coachNotes: null,
  });
  refreshEntries();
}
```

- Remove `handleAcceptReframe` and `handleDismissReframe` entirely.

- Remove the `saving={reframeLoading}` prop from `<EntryForm ... />` in the JSX.

- Remove the entire `reframeLoading` block:

```diff
-              {reframeLoading && (
-                <p
-                  role="status"
- ...
-                  Reframing your entry...
-                </p>
-              )}
```

- Remove the entire `reframeError` block:

```diff
-              {reframeError && (
-                <p
-                  role="alert"
- ...
-                  {reframeError}
-                </p>
-              )}
```

- Remove the entire `reframing && <ReframeView ... />` block.

- Replace `handleReframeAgain` (which currently posts to `/api/reframe`). For now, make it a no-op by removing the function entirely. Also remove the `onReframeAgain={handleReframeAgain}` prop from `<EntryList ...>`, **and** plan to remove the prop from `EntryList` itself in Task 16.

- Add two new handlers for the coach flow that Task 16 will wire into `EntryList`:

```typescript
function handleCoachAccept(id: string, reframed: string, notes: string[]) {
  updateEntry(id, { reframed, coachNotes: notes });
  refreshEntries();
}

function handleCoachDismiss(id: string) {
  updateEntry(id, { coachNotes: [] });
  refreshEntries();
}
```

Pass them as props to `<EntryList>`:

```tsx
<EntryList
  entries={entries}
  tags={tags}
  onEditEntry={handleEditEntry}
  onDeleteEntry={handleDeleteEntry}
  onCoachAccept={handleCoachAccept}
  onCoachDismiss={handleCoachDismiss}
/>
```

(`EntryList`'s prop signature changes in Task 16. TypeScript will complain about the missing props on `EntryList` until then — that is expected.)

- [ ] **Step 3: Strip the `saving` prop from `EntryForm.tsx`**

In `frontend/src/components/EntryForm.tsx`:

- Remove `saving?: boolean;` from `EntryFormProps`.
- Remove `saving = false,` from the destructured params.
- Replace `disabled={!text.trim() || saving}` with `disabled={!text.trim()}`.
- Replace `cursor: text.trim() && !saving ? "pointer" : "not-allowed"` with `cursor: text.trim() ? "pointer" : "not-allowed"`.
- Replace `opacity: text.trim() && !saving ? 1 : 0.4` with `opacity: text.trim() ? 1 : 0.4`.

- [ ] **Step 4: Update `EntryForm.test.tsx`**

Open `frontend/src/components/EntryForm.test.tsx` and remove any test that passes a `saving` prop or asserts the button is disabled while saving. Other tests stay.

- [ ] **Step 5: Run frontend type-check (it will still fail until Task 16; check that the only errors are in `EntryList` props)**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors in `App.tsx` about `EntryList`'s missing/extra props. No other errors. If there are errors elsewhere, address them before moving on.

- [ ] **Step 6: Stop for commit**

Suggested message: `refactor: strip auto-reframe wiring from App and EntryForm`

---

## Task 16: Wire `CoachPanel` into `EntryList` and add the Talk-it-through button

**Files:**
- Modify: `frontend/src/components/EntryList.tsx`
- Modify: `frontend/src/components/EntryList.test.tsx`

`EntryList` gains:

- A new prop signature: replace `onReframeAgain` with `onCoachAccept(entryId, reframed, notes)` and `onCoachDismiss(entryId)`.
- A "Talk it through with the coach" button shown on entries where `coachNotes === null`.
- An inline `CoachPanel` mounted when the user clicks the button.
- A `CoachNotePills` row near the entry meta when `coachNotes` is a non-empty array.
- Removal of the existing "Reframe again" link and its `reframingId`/`reframeErrorId` state (the new flow obsoletes both).

- [ ] **Step 1: Write the failing tests**

Open `frontend/src/components/EntryList.test.tsx` and add:

```tsx
import { vi } from "vitest";
import { CoachPanel } from "./CoachPanel";

vi.mock("./CoachPanel", () => ({
  CoachPanel: vi.fn(() => <div data-testid="mock-coach-panel">coach panel</div>),
}));
```

Then add the following tests inside the existing top-level describe (or in a new `describe("EntryList — coach", ...)`):

```tsx
const baseEntry = {
  id: "e1",
  date: "2026-04-01",
  prompt: "What did you ship?",
  original: "Led the migration",
  reframed: null,
  tags: ["technical"],
  createdAt: "2026-04-01T18:00:00Z",
  coachNotes: null,
};

const renderList = (entries: typeof baseEntry[]) =>
  render(
    <EntryList
      entries={entries}
      tags={[{ name: "technical", color: "#6B8AE0" }]}
      onEditEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
      onCoachAccept={vi.fn()}
      onCoachDismiss={vi.fn()}
    />
  );

describe("EntryList — coach affordance", () => {
  it("shows the Talk-it-through button when coachNotes is null", () => {
    renderList([baseEntry]);
    expect(
      screen.getByRole("button", { name: /talk it through/i })
    ).toBeInTheDocument();
  });

  it("hides the Talk-it-through button when coachNotes is an empty array", () => {
    renderList([{ ...baseEntry, coachNotes: [] }]);
    expect(
      screen.queryByRole("button", { name: /talk it through/i })
    ).not.toBeInTheDocument();
  });

  it("hides the Talk-it-through button when coachNotes is populated", () => {
    renderList([{ ...baseEntry, coachNotes: ["hedging"] }]);
    expect(
      screen.queryByRole("button", { name: /talk it through/i })
    ).not.toBeInTheDocument();
  });

  it("renders coach-note pills when coachNotes has entries", () => {
    renderList([{ ...baseEntry, coachNotes: ["hedging", "missing-scope"] }]);
    expect(screen.getByText("hedging")).toBeInTheDocument();
    expect(screen.getByText("missing-scope")).toBeInTheDocument();
  });

  it("does not render the pill row when coachNotes is empty array", () => {
    renderList([{ ...baseEntry, coachNotes: [] }]);
    expect(screen.queryByText("hedging")).not.toBeInTheDocument();
  });

  it("mounts CoachPanel when Talk-it-through is clicked", async () => {
    renderList([baseEntry]);
    expect(screen.queryByTestId("mock-coach-panel")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /talk it through/i })
    );
    expect(screen.getByTestId("mock-coach-panel")).toBeInTheDocument();
  });

  it("only one CoachPanel is open across multiple entries", async () => {
    const second = { ...baseEntry, id: "e2", date: "2026-04-02" };
    renderList([baseEntry, second]);

    const buttons = screen.getAllByRole("button", { name: /talk it through/i });
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);

    expect(screen.getAllByTestId("mock-coach-panel")).toHaveLength(1);
  });
});
```

If `EntryList.test.tsx` already imports `userEvent`, do not re-import. Same for `screen` and `render`.

Run: `cd frontend && npx vitest run src/components/EntryList.test.tsx`
Expected: the new tests FAIL.

Note: any **existing** tests in this file that exercised the "Reframe again" link or `onReframeAgain` prop will start failing in Step 2 below. Delete them along with the prop change.

- [ ] **Step 2: Update `EntryList.tsx`**

Open `frontend/src/components/EntryList.tsx` and apply these changes:

- Replace the import block at the top (keep the `"use client"` directive). Add the `CoachPanel` and `CoachNotePills` imports:

```tsx
import { useState } from "react";
import type { Entry } from "@/lib/types";
import { tagColorFor, type TagDef } from "@/lib/tags";
import { TagPicker } from "./TagPicker";
import { CoachPanel } from "./CoachPanel";
import { CoachNotePills } from "./CoachNotePills";
```

- Update the `EntryListProps` interface:

```tsx
interface EntryListProps {
  entries: Entry[];
  tags: TagDef[];
  onEditEntry: (
    id: string,
    updates: { original?: string; tags?: string[] }
  ) => void;
  onDeleteEntry: (id: string) => void;
  onCoachAccept: (entryId: string, reframed: string, notes: string[]) => void;
  onCoachDismiss: (entryId: string) => void;
}
```

(Drop `onReframeAgain`.)

- Update the destructured props in the component signature:

```tsx
export function EntryList({
  entries,
  tags,
  onEditEntry,
  onDeleteEntry,
  onCoachAccept,
  onCoachDismiss,
}: EntryListProps) {
```

- Remove the `reframingId` and `reframeErrorId` state declarations and the `handleReframeAgain` function.

- Add new state for the open coach panel:

```tsx
const [coachOpenId, setCoachOpenId] = useState<string | null>(null);
```

- In the JSX, inside each `entries.map(...)` iteration, replace the `<EntryRowBody ... />` invocation. The new body should:
  - Render the entry text and the existing reframed-toggle behaviour (preserving the `reframed` rendering already in `EntryRowBody`).
  - Add a row showing `CoachNotePills` next to the date when `entry.coachNotes` is non-empty.
  - Add a "Talk it through with the coach" button when `entry.coachNotes === null` and the panel for this entry is not currently open.
  - Mount `<CoachPanel ... />` inline when `coachOpenId === entry.id`.

The simplest implementation: replace the `EntryRowBody` props (drop `onReframeAgain`, `reframing`, `reframeError`) and add a coach-section block immediately after `EntryRowBody`:

```tsx
<EntryRowBody
  entry={entry}
  expanded={expanded.has(entry.id)}
  onToggleReframed={() => toggleExpanded(entry.id)}
/>
{entry.coachNotes && entry.coachNotes.length > 0 && (
  <div style={{ marginTop: "8px" }}>
    <CoachNotePills notes={entry.coachNotes} />
  </div>
)}
{entry.coachNotes === null && coachOpenId !== entry.id && (
  <button
    type="button"
    onClick={() => setCoachOpenId(entry.id)}
    style={{
      marginTop: "10px",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      color: "var(--color-accent)",
      background: "none",
      border: "1px solid var(--color-accent-border)",
      borderRadius: "var(--radius-sm)",
      padding: "6px 12px",
      cursor: "pointer",
      letterSpacing: "0.03em",
    }}
  >
    Talk it through with the coach
  </button>
)}
{coachOpenId === entry.id && (
  <CoachPanel
    entry={{
      id: entry.id,
      original: entry.original,
      prompt: entry.prompt,
      tags: entry.tags,
    }}
    onAccept={(reframed, notes) => {
      onCoachAccept(entry.id, reframed, notes);
      setCoachOpenId(null);
    }}
    onDismiss={() => {
      onCoachDismiss(entry.id);
      setCoachOpenId(null);
    }}
    onClose={() => setCoachOpenId(null)}
  />
)}
```

- Update the `EntryRowBody` component below to drop the now-unused props. Replace its interface and signature:

```tsx
interface EntryRowBodyProps {
  entry: Entry;
  expanded: boolean;
  onToggleReframed: () => void;
}

function EntryRowBody({
  entry,
  expanded,
  onToggleReframed,
}: EntryRowBodyProps) {
  return (
    <div>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
        }}
      >
        {entry.original}
      </p>
      {entry.reframed && (
        <>
          <button
            onClick={onToggleReframed}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0",
              marginTop: "8px",
              letterSpacing: "0.03em",
            }}
          >
            {expanded ? "Hide reframed" : "Show reframed"}
          </button>
          {expanded && (
            <p
              style={{
                color: "var(--color-text-primary)",
                borderLeft: "2px solid var(--color-accent)",
                paddingLeft: "12px",
                marginTop: "8px",
                fontSize: "14px",
                lineHeight: 1.6,
                animation: "fadeIn 0.25s ease both",
              }}
            >
              {entry.reframed}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

(The "Reframe again" branch is removed entirely.)

- [ ] **Step 3: Run all `EntryList` tests**

Run: `cd frontend && npx vitest run src/components/EntryList.test.tsx`
Expected: all tests PASS, including the seven new coach-affordance tests.

If any old tests fail because they reference the deleted "Reframe again" or `onReframeAgain` prop, delete those tests.

- [ ] **Step 4: Run the full frontend type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors anywhere in the frontend.

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Stop for commit**

Suggested message: `feat: wire CoachPanel into EntryList with Talk-it-through button`

---

## Task 17: Update `journal.spec.ts` and add `coach.spec.ts` happy-path E2E

**Files:**
- Modify: `frontend/e2e/journal.spec.ts`
- Create: `frontend/e2e/coach.spec.ts`

- [ ] **Step 1: Update `journal.spec.ts`**

Open `frontend/e2e/journal.spec.ts` and:

- Remove the `page.route("**/api/reframe", ...)` block from `beforeEach`. Save no longer triggers any AI call.
- Keep all other tests as-is.
- Verify the file still imports only what it uses.

The new `beforeEach` should be:

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
```

- [ ] **Step 2: Run the journal E2E to confirm no regression**

Run: `cd frontend && npx playwright test e2e/journal.spec.ts`
Expected: all tests PASS.

- [ ] **Step 3: Create `frontend/e2e/coach.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  let turnCalls = 0;
  await page.route("**/api/coach/turn", async (route) => {
    turnCalls += 1;
    const body =
      turnCalls === 1
        ? {
            text: "Who specifically benefited from the migration?",
            notes: ["missing-audience"],
          }
        : { text: "How big was the impact?", notes: [] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/api/coach/reframe", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reframed: "Led the migration that unblocked 40 platform engineers",
        notes: ["hedging", "missing-audience"],
      }),
    })
  );
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("user can talk through an entry with the coach and accept the reframe", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "I just helped a bit with the migration"
  );
  await page.click('button:has-text("Save")');

  await expect(
    page.locator("p:has-text('I just helped a bit with the migration')")
  ).toBeVisible();

  await page.click('button:has-text("Talk it through with the coach")');

  await expect(
    page.locator("text=Who specifically benefited from the migration?")
  ).toBeVisible();
  await expect(page.locator("text=missing-audience").first()).toBeVisible();

  await page.fill(
    'textarea[id^="coach-reply-"]',
    "The platform team — about 40 engineers"
  );
  await page.click('button:has-text("Send reply")');

  await expect(page.locator("text=How big was the impact?")).toBeVisible();

  await page.click('button:has-text("Reframe it now")');

  await expect(
    page.locator(
      'textarea:has-text("Led the migration that unblocked 40 platform engineers")'
    )
  ).toBeVisible();

  await page.click('button:has-text("Accept")');

  // Coach panel collapses; pills appear near the entry; button is gone.
  await expect(
    page.locator("text=hedging").first()
  ).toBeVisible();
  await expect(
    page.locator('button:has-text("Talk it through with the coach")')
  ).toHaveCount(0);
});

test("dismissing the reframe retires the button but keeps the entry untouched", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "I just helped a bit with the migration"
  );
  await page.click('button:has-text("Save")');

  await page.click('button:has-text("Talk it through with the coach")');
  await expect(
    page.locator("text=Who specifically benefited from the migration?")
  ).toBeVisible();

  await page.click('button:has-text("Reframe it now")');
  await page.click('button:has-text("Dismiss")');

  // Button is retired (coachNotes === []), original is unchanged, no reframed toggle.
  await expect(
    page.locator('button:has-text("Talk it through with the coach")')
  ).toHaveCount(0);
  await expect(
    page.locator("p:has-text('I just helped a bit with the migration')")
  ).toBeVisible();
  await expect(page.locator('button:has-text("Show reframed")')).toHaveCount(0);
});

test("closing the coach mid-conversation keeps the button available", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "I just helped a bit with the migration"
  );
  await page.click('button:has-text("Save")');

  await page.click('button:has-text("Talk it through with the coach")');
  await expect(
    page.locator("text=Who specifically benefited from the migration?")
  ).toBeVisible();

  await page.click('button[aria-label="Close coach"]');

  // Button stays available because reframe was never offered.
  await expect(
    page.locator('button:has-text("Talk it through with the coach")')
  ).toBeVisible();
});
```

- [ ] **Step 4: Run the new coach E2E**

Run: `cd frontend && npx playwright test e2e/coach.spec.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Stop for commit**

Suggested message: `test: e2e coverage for coach happy path`

---

## Task 18: Add the coach error E2E

**Files:**
- Create: `frontend/e2e/coach-error.spec.ts`

- [ ] **Step 1: Create the file**

```typescript
import { test, expect } from "@playwright/test";

test("coach turn failure renders inline error with retry", async ({ page }) => {
  let firstCall = true;
  await page.route("**/api/coach/turn", async (route) => {
    if (firstCall) {
      firstCall = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Coach turn failed" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ text: "Recovered.", notes: [] }),
      });
    }
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "Did a thing"
  );
  await page.click('button:has-text("Save")');
  await page.click('button:has-text("Talk it through with the coach")');

  await expect(page.locator("text=/coach didn['']t respond/i")).toBeVisible();
  await expect(page.locator('button:has-text("Retry")')).toBeVisible();

  await page.click('button:has-text("Retry")');

  await expect(page.locator("text=Recovered.")).toBeVisible();
});
```

- [ ] **Step 2: Run the test**

Run: `cd frontend && npx playwright test e2e/coach-error.spec.ts`
Expected: PASS.

- [ ] **Step 3: Stop for commit**

Suggested message: `test: e2e coverage for coach error path`

---

## Task 19: Final verification

**Files:** none modified.

- [ ] **Step 1: Backend tests**

Run: `cd backend && uv run pytest -v`
Expected: all tests PASS — `test_health.py`, `test_coach.py` (11 tests), `test_brag_doc.py`. No `test_reframe.py`.

- [ ] **Step 2: Frontend lint**

Run: `cd frontend && npm run lint`
Expected: no warnings, no errors.

- [ ] **Step 3: Frontend type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Frontend unit tests**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Frontend production build**

Run: `cd frontend && npm run build`
Expected: build succeeds, both `/api/coach/turn` and `/api/coach/reframe` appear in the routes summary, `/api/reframe` does not.

- [ ] **Step 6: Frontend Playwright suite**

Run: `cd frontend && npx playwright test`
Expected: all suites PASS — `journal.spec.ts`, `brag-doc.spec.ts`, `categories.spec.ts`, `entries.spec.ts`, `persistence.spec.ts`, `coach.spec.ts`, `coach-error.spec.ts`.

- [ ] **Step 7: Manual smoke test**

In one terminal:

```bash
cd backend && uv run uvicorn main:app --reload
```

In another:

```bash
cd frontend && npm run dev
```

In a browser, walk through the full happy path:

1. Load `http://localhost:3000`. Confirm no console errors.
2. Write an entry with hedging language ("I just helped a bit with the rollout"). Tag it. Click **Save**. Toast appears; entry appears in the list immediately. No reframing happens.
3. Click **Talk it through with the coach** on the new entry. Coach panel expands beneath the entry; first turn fetches and renders with prose + tag pills.
4. Type a reply. Click **Send reply**. User bubble appears, then a second coach turn renders.
5. Click **Reframe it now**. `ReframeView` renders inside the panel showing original on the left and the reframed text in an editable textarea on the right, plus a "What the coach noticed" footer with pills.
6. Click **Accept**. Panel collapses. Entry now shows: original text, "Show reframed" toggle (which reveals the reframed version with the amber border), and coach-note pills near the date. **Talk it through** button is gone.
7. Reload the page. Same state persists.
8. Repeat with a second entry, but on the reframe step click **Dismiss**. Confirm panel collapses, no "Show reframed" toggle, button is gone, no pills appear (because notes were not persisted).
9. Repeat with a third entry, but click the **Close** button on the panel before clicking **Reframe it now**. Confirm the panel collapses and the **Talk it through** button stays available.
10. Confirm the Brag Doc tab still works end-to-end with the new entries (the addition of `coachNotes` should not break it).

If anything in steps 1–10 fails, file a bug and fix before declaring complete.

- [ ] **Step 8: Stop for final commit (if needed)**

Only if Step 7 surfaced any cleanup. Otherwise, the implementation is complete.
