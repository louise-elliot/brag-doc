# Backend Walkthrough — Coaching Style and User Context

A self-paced guide that walks you through the backend changes for the coach style + user context feature. The frontend has its own implementation plan in `docs/superpowers/plans/2026-05-06-coach-style-and-context-frontend.md` — this document is the parallel track for the backend, designed for you to type out yourself with explanation along the way.

You'll touch four files (`main.py`, `prompts.py`, `coach.py`, `brag_doc.py`) and add tests. Total work is small — maybe 90 minutes if you read the side-notes — but it touches four useful concepts: Pydantic `Literal` validation, dict-based dispatch, prompt composition, and substring-asserting tests.

**Spec:** `docs/superpowers/specs/coach-style-and-context-design.md`

---

## How to use this guide

Each section has the same shape:

1. **What we're doing** — one or two lines.
2. **Why** — the design reason, sometimes with a side-note on the language feature in play.
3. **Where to type it** — file + roughly where in the file.
4. **Code** — the actual change.
5. **Verify** — a small command to run before moving on.

Commit when it feels natural — sensible boundaries are after Step 1, after Step 4, after Step 7, and after the test step. Run `pytest` from the `backend/` directory; run `uv sync` first if your venv is fresh.

A note on testing approach: we will not snapshot the entire system prompt. We'll instead assert that specific substrings appear (or don't) in the prompt that gets sent to Anthropic. That's deliberate — prompt-text snapshots are brittle, and what we actually care about is *"the right fragment is present when style X is selected"*.

---

## Step 1 — Add request schema fields

**What.** Extend the three Pydantic request models in `main.py` with two optional new fields: `coaching_style` and `user_context` for the coach endpoints, and just `user_context` for the brag-doc endpoint.

**Why.** This is the wire contract between the Next.js proxy routes and the Python service. Pydantic validates the shape on the way in, which means an invalid `coaching_style` value gets a 422 *before* our code ever sees it. We keep the fields **optional with defaults** so the existing test suite (which doesn't send these fields) keeps passing without modification.

> **Side-note: `Literal` types.** `Literal["a", "b", "c"]` is a type that only accepts those exact string values. Pydantic uses it for validation — anything outside the set is rejected with HTTP 422. It's the cleanest way to enumerate a closed set in Python without reaching for `Enum`.

**Where.** `backend/main.py`, near the top with the other Pydantic models.

Add a new type alias and a `UserContext` model. Place this above `class Entry(BaseModel)`:

```python
from typing import Literal

CoachingStyle = Literal[
    "trusted-mentor", "hype-woman", "direct-challenger", "bold-coach"
]


class UserContext(BaseModel):
    headline: str
    notes: str
```

Then extend the three request models. For `BragDocRequest`:

```python
class BragDocRequest(BaseModel):
    entries: list[Entry]
    groupBy: GroupBy = "tag"
    userPrompt: str | None = None
    user_context: UserContext | None = None  # new
```

For `CoachTurnRequest`:

```python
class CoachTurnRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]
    coaching_style: CoachingStyle = "trusted-mentor"  # new
    user_context: UserContext | None = None           # new
```

For `CoachReframeRequest`:

```python
class CoachReframeRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]
    coaching_style: CoachingStyle = "trusted-mentor"  # new
    user_context: UserContext | None = None           # new
```

**Verify.**

```sh
cd backend
pytest
```

Expected: existing tests still pass. The new fields default in for any test that doesn't supply them.

> **If you see "ImportError: cannot import name 'Literal'":** you're on Python <3.8 — but you're on 3.12, so this won't happen. More likely cause if anything goes wrong: a typo in one of the kebab-case keys. They must match the frontend exactly: `trusted-mentor`, `hype-woman`, `direct-challenger`, `bold-coach`.

---

## Step 2 — Add the style fragments

**What.** Define a dict of four strings, each describing the *voice* of one coaching style. These get appended to the system prompt at request time.

**Why.** Two reasons. First, putting fragments next to the system prompts they modify keeps related text in one file (`prompts.py` is the canonical "all prompt strings live here" location). Second, a dict is the simplest dispatch — `STYLE_FRAGMENTS[style]` is a single lookup, no `if/elif` chains.

> **Side-note: voice vs. rules.** The fragments describe *only* voice. They must never override the rules in `COACH_TURN_SYSTEM_PROMPT` (max 3 patterns, kebab-case tags, JSON output, etc.). Style is a coat of paint on top of the architecture — not a rewrite of the architecture. We'll add a test in Step 8 that confirms the original rules are still in the composed prompt.

**Where.** `backend/prompts.py`, at the bottom of the file (after `GROUP_BY_CLAUSES`).

```python
COACH_STYLE_FRAGMENTS: dict[str, str] = {
    "trusted-mentor": (
        "Voice: warm, wise, unhurried. You are the coach the user trusts to "
        "tell them the truth gently. Use 'I notice...' framing. Land observations "
        "softly, but land them. Never sycophantic — warmth is not the same as flattery."
    ),
    "hype-woman": (
        "Voice: high energy, celebratory, zero tolerance for shrinking. You "
        "amplify what they already did. When you spot minimising language, you "
        "name it with affection ('Stop. Read that sentence back. You owned that.'). "
        "Pick energy without losing precision."
    ),
    "direct-challenger": (
        "Voice: high challenge, low ceremony. Cut to the chase. No throat-clearing, "
        "no softening preambles. State what you noticed and what's underselling them, "
        "in that order. Respect the user enough to be direct — they came here for clarity, "
        "not coddling."
    ),
    "bold-coach": (
        "Voice: playful, punchy, modern. You can be wry. You can use 'okay but' "
        "and 'real talk' and the occasional rhetorical question. Keep it sharp, not "
        "snarky — the user is on their own side and so are you."
    ),
}
```

You can edit the wording later — the structure is what matters. Each fragment is a single string under ~5 lines. They're written as voice prompts, not rule prompts.

**Verify.**

```sh
cd backend
python -c "from prompts import COACH_STYLE_FRAGMENTS; print(list(COACH_STYLE_FRAGMENTS))"
```

Expected output:

```
['trusted-mentor', 'hype-woman', 'direct-challenger', 'bold-coach']
```

> **If you see a `SyntaxError`:** check that all four entries end with a comma except they can also have one — Python is fine either way as long as parens balance. Most common cause is an unclosed parenthesis on a multi-line string.

---

## Step 3 — Build the coach prompt builder

**What.** Add a helper in `coach.py` that takes a base prompt, a style key, and an optional user context, and returns the composed system prompt as a single string.

**Why.** Separating *prompt assembly* from *API call* gives us a function we can test on its own (no network, no mocks needed). It also keeps the route handler in `main.py` blissfully unaware of how prompts are built — its job is just to translate HTTP into a function call.

> **Side-note: builder pattern.** When something has multiple possible compositions, "build a string from typed inputs" is a recognisable shape. The function takes the inputs that *might* shape the output and returns the result. Easy to call, easy to test in isolation, easy to read.

**Where.** `backend/coach.py`, after the existing `_format_user_content` helper. Also add an import for `COACH_STYLE_FRAGMENTS`.

Update the import line at the top:

```python
from prompts import (
    COACH_REFRAME_SYSTEM_PROMPT,
    COACH_STYLE_FRAGMENTS,
    COACH_TURN_SYSTEM_PROMPT,
)
```

You'll also need the `UserContext` type. Rather than re-importing from `main.py` (which would create a circular import), define a small Pydantic model right here. Add it next to `Message`:

```python
class UserContext(BaseModel):
    headline: str
    notes: str
```

> **Side-note: avoiding circular imports.** `main.py` imports from `coach.py`. If `coach.py` then imported from `main.py`, Python would deadlock at import time. Defining `UserContext` in `coach.py` (and re-using it from `main.py`) solves this. We'll wire `main.py` to use the same class in Step 5.

Add the builder and the context-block formatter below `_format_user_content`:

```python
def _format_user_context_block(context: UserContext) -> str:
    return (
        "## About the user:\n"
        f"Headline: {context.headline.strip()}\n"
        f"Context: {context.notes.strip()}"
    )


def build_coach_system_prompt(
    base: str,
    style: str,
    context: UserContext | None,
) -> str:
    parts = [base, COACH_STYLE_FRAGMENTS[style]]
    if context and (context.headline.strip() or context.notes.strip()):
        parts.append(_format_user_context_block(context))
    return "\n\n".join(parts)
```

A few details worth noticing:

- We strip whitespace when **deciding** whether to include the block, but we don't strip the values themselves on output (we do a `.strip()` per line for tidiness in the prompt). The user's formatting is preserved everywhere else.
- We use `"\n\n".join(parts)` rather than f-strings with embedded newlines — it's tidier and reads as "compose these pieces with blank lines between them".
- `base` is a parameter rather than imported here, so the same builder works for both `COACH_TURN_SYSTEM_PROMPT` and `COACH_REFRAME_SYSTEM_PROMPT`.

**Verify.** No verification command yet — we'll exercise this through `coach_turn` in the next step.

---

## Step 4 — Update `coach_turn` and `coach_reframe`

**What.** Thread the new parameters into both functions and have them call the builder.

**Where.** `backend/coach.py`, replacing the bodies of `coach_turn` and `coach_reframe`.

```python
def coach_turn(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    coaching_style: str,           # new
    user_context: UserContext | None,  # new
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, coaching_style, user_context
        ),
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


def coach_reframe(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    coaching_style: str,           # new
    user_context: UserContext | None,  # new
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=build_coach_system_prompt(
            COACH_REFRAME_SYSTEM_PROMPT, coaching_style, user_context
        ),
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

The only structural change in each function is the `system=` line — instead of passing the constant directly, we pass the builder's output.

> **Side-note: positional argument order.** I put `coaching_style` and `user_context` *before* `client` because the existing convention has `client` last (it's the dependency-injected one). Keep the new positional args in the same place across both functions so callers can be consistent.

**Verify.** Existing tests will fail now — that's expected, because they don't pass the new arguments. We'll fix those in Step 5 by wiring the routes, and again in Step 8 with new tests. For now:

```sh
cd backend
pytest tests/test_coach.py -k "passes_entry_prompt" -v
```

Expected: this specific test fails because `coach_turn` no longer accepts the old call shape. That's our signal that the function signature genuinely changed — good. We're about to make the rest of the wiring catch up.

---

## Step 5 — Wire the coach routes in `main.py`

**What.** Pass the new fields from the validated request body through to `coach_turn` / `coach_reframe`.

**Why.** The route handler is the seam between HTTP and Python. It pulls validated fields off `body` and hands them to the function. There's no logic here — that's deliberate.

**Where.** `backend/main.py`, in `coach_turn_route` and `coach_reframe_route`.

> **First housekeeping:** `main.py` currently defines its own `class UserContext` (we added it in Step 1). Replace that local definition with an import from `coach.py` so both modules share the same type:

At the top of `main.py`, change the `coach` import line:

```python
from coach import Message, UserContext, coach_reframe, coach_turn
```

Then **delete** the local `class UserContext(BaseModel)` block you added in Step 1 — `main.py` now uses the one from `coach.py`. The Pydantic models that reference `UserContext` (the three request classes) will pick up the imported version automatically.

Now wire the route handlers. Update `coach_turn_route`:

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
            coaching_style=body.coaching_style,   # new
            user_context=body.user_context,       # new
            client=client,
        )
    except Exception:
        logger.exception("coach turn call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach turn failed"}
        )
    return CoachTurnResponse(text=result["text"], notes=result["notes"])
```

And `coach_reframe_route`:

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
            coaching_style=body.coaching_style,   # new
            user_context=body.user_context,       # new
            client=client,
        )
    except Exception:
        logger.exception("coach reframe call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach reframe failed"}
        )
    return CoachReframeResponse(reframed=result["reframed"], notes=result["notes"])
```

**Verify.**

```sh
cd backend
pytest tests/test_coach.py
```

Expected: the existing coach tests now pass again. Pydantic supplies the default `coaching_style="trusted-mentor"` and `user_context=None` for any test that doesn't send them, so no test rewrites are needed for compatibility.

> **If you see `TypeError: coach_turn() missing 2 required positional arguments`:** the test calls `coach_turn` directly, not through the API. You'd need to update the call site in the test. Look for it in `tests/test_coach.py` — but most likely *all* tests there go through `http_client.post(...)` which means Pydantic handles defaulting and no test changes are needed. If you do find a direct call, update it to pass `coaching_style="trusted-mentor"` and `user_context=None`.

---

## Step 6 — Update the brag-doc builder

**What.** Extend `brag_doc.py`'s `build_system_prompt` to also accept and embed user context.

**Why.** Same reason as the coach side — context can shape the bullets the LLM produces (a senior IC's review reads differently from a first-time manager's). Style does *not* apply to brag doc — bullets are written for a reviewer audience and stay in a neutral professional voice.

**Where.** `backend/brag_doc.py`. Two changes: extend `build_system_prompt`, and import `UserContext` from `coach.py`.

At the top of `brag_doc.py`, add an import:

```python
from coach import UserContext
```

Then update `build_system_prompt` to accept `user_context`:

```python
def build_system_prompt(
    group_by: GroupBy,
    user_prompt: str | None,
    user_context: UserContext | None,  # new
) -> str:
    trimmed = (user_prompt or "").strip()
    guidance = (
        f"\n\nThe user has added this additional guidance: {trimmed}\n\n"
        "Honor it while keeping your core role as a performance review coach."
        if trimmed
        else ""
    )
    context_block = ""
    if user_context and (
        user_context.headline.strip() or user_context.notes.strip()
    ):
        context_block = (
            "\n\n## About the user:\n"
            f"Headline: {user_context.headline.strip()}\n"
            f"Context: {user_context.notes.strip()}"
        )
    return f"{BRAG_DOC_BASE_PROMPT}\n\n{GROUP_BY_CLAUSES[group_by]}{guidance}{context_block}"
```

> **Side-note: why duplicate the formatter?** You might notice this looks similar to `_format_user_context_block` in `coach.py`. We could factor it out — and if a third caller appears, we should. For now, two short, near-identical helpers are clearer than a shared one whose interface has to accommodate both call sites. (DRY is a good rule, but premature abstraction is the bigger pitfall.)

Update `generate_brag_doc` to take and forward the new parameter:

```python
def generate_brag_doc(
    entries: list[dict],
    group_by: GroupBy,
    user_prompt: str | None,
    user_context: UserContext | None,  # new
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=build_system_prompt(group_by, user_prompt, user_context),
        messages=[{"role": "user", "content": _format_entries(entries)}],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    return json.loads(_strip_code_fences(raw))
```

**Verify.** Existing brag-doc tests will fail at `generate_brag_doc()` not accepting the call shape. Same fix as before — the route in `main.py` defaults the value, and we'll fix any direct callers in tests if needed. Run:

```sh
cd backend
pytest tests/test_brag_doc.py
```

Expected: failures pointing at missing `user_context`. Move on to Step 7.

---

## Step 7 — Wire the brag-doc route

**Where.** `backend/main.py`, in `brag_doc_route`.

```python
@app.post("/generate-brag-doc")
def brag_doc_route(
    body: BragDocRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        result = generate_brag_doc(
            entries=[e.model_dump() for e in body.entries],
            group_by=body.groupBy,
            user_prompt=body.userPrompt,
            user_context=body.user_context,   # new
            client=client,
        )
    except Exception:
        logger.exception("brag doc generation failed")
        return JSONResponse(
            status_code=500, content={"error": "Brag doc generation failed"}
        )
    return result
```

**Verify.**

```sh
cd backend
pytest
```

Expected: full suite passes. If anything in `tests/test_brag_doc.py` was calling `generate_brag_doc` directly without going through the API, you'll need to add `user_context=None` to that call.

> **Commit checkpoint.** This is a natural moment to commit. The behaviour is unchanged for any caller that doesn't supply the new fields, but the wiring is in place.

---

## Step 8 — Add tests

**What.** Three categories of new tests: prompt-builder unit tests, coach-endpoint substring tests, brag-doc context tests.

**Why.** We want to verify behaviour, not snapshot prose. The assertions check that *the right substrings appear (or don't)* in the system prompt sent to Anthropic. That's resilient to wording changes in the fragments.

**Where.** `backend/tests/test_coach.py` (extend) and `backend/tests/test_brag_doc.py` (extend). You can add a new file for the pure-function builder tests if you prefer — `backend/tests/test_prompts.py` would be a sensible home — or just slot them into `test_coach.py`. I'll show them in `test_coach.py` for proximity to the code they exercise.

Add to `test_coach.py`:

```python
from coach import UserContext, build_coach_system_prompt
from prompts import (
    COACH_STYLE_FRAGMENTS,
    COACH_TURN_SYSTEM_PROMPT,
)


class TestBuildCoachSystemPrompt:
    def test_appends_the_fragment_for_the_requested_style(self):
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "hype-woman", None
        )
        assert COACH_STYLE_FRAGMENTS["hype-woman"] in result

    def test_keeps_the_underlying_coaching_rules(self):
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", None
        )
        # A rule from the original system prompt — adjust the substring if you
        # rephrase the prompt.
        assert "career coach for women in tech" in result

    def test_includes_the_about_the_user_block_when_context_provided(self):
        ctx = UserContext(
            headline="Senior backend engineer",
            notes="Working towards staff promotion",
        )
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", ctx
        )
        assert "## About the user:" in result
        assert "Senior backend engineer" in result
        assert "Working towards staff promotion" in result

    def test_omits_the_block_when_context_is_none(self):
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", None
        )
        assert "## About the user:" not in result

    def test_omits_the_block_when_both_fields_are_whitespace(self):
        ctx = UserContext(headline="   ", notes="\n\n")
        result = build_coach_system_prompt(
            COACH_TURN_SYSTEM_PROMPT, "trusted-mentor", ctx
        )
        assert "## About the user:" not in result
```

And an integration-style test that goes through the route, asserting that the system sent to Anthropic contains the expected substrings:

```python
class TestCoachTurnEndpointPersonalisation:
    def test_uses_the_requested_style_fragment_in_the_system_prompt(
        self, mock_client, http_client
    ):
        _mock_text_response(
            mock_client, json.dumps({"text": "ok", "notes": []})
        )
        body = {**SAMPLE_TURN_BODY, "coaching_style": "direct-challenger"}

        http_client.post("/coach/turn", json=body)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert COACH_STYLE_FRAGMENTS["direct-challenger"] in system

    def test_includes_user_context_block_when_provided(
        self, mock_client, http_client
    ):
        _mock_text_response(
            mock_client, json.dumps({"text": "ok", "notes": []})
        )
        body = {
            **SAMPLE_TURN_BODY,
            "user_context": {
                "headline": "Staff PM",
                "notes": "promo case to director",
            },
        }

        http_client.post("/coach/turn", json=body)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "Staff PM" in system
        assert "promo case to director" in system

    def test_rejects_unknown_coaching_style(self, mock_client, http_client):
        body = {**SAMPLE_TURN_BODY, "coaching_style": "drill-sergeant"}
        response = http_client.post("/coach/turn", json=body)
        assert response.status_code == 422
```

Add to `test_brag_doc.py`:

```python
class TestBragDocUserContext:
    def test_includes_user_context_in_system_prompt_when_provided(
        self, mock_client, http_client
    ):
        # ...mock a successful brag-doc response...
        body = {
            "entries": [],
            "user_context": {"headline": "Staff IC", "notes": "year of impact"},
        }

        http_client.post("/generate-brag-doc", json=body)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "Staff IC" in system
        assert "year of impact" in system

    def test_omits_user_context_block_when_null(
        self, mock_client, http_client
    ):
        # ...mock a successful brag-doc response...
        body = {"entries": [], "user_context": None}

        http_client.post("/generate-brag-doc", json=body)

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "## About the user:" not in system
```

Use the same `_mock_text_response` and `mock_client`/`http_client` fixtures the existing brag-doc tests use; copy the patterns from the file.

**Verify.**

```sh
cd backend
pytest -v
```

Expected: all tests pass — both the new ones and the existing ones.

> **If only the new tests fail:** read the assertion error carefully. The most common cause is a substring mismatch — e.g., you've used a slightly different phrase in the fragment than in the test. Either change the fragment to include the asserted substring, or change the test to assert what the fragment actually says.

---

## Final smoke test

Once all tests pass, run a manual end-to-end with the dev server and the frontend wired up. With the backend running:

```sh
cd backend
uvicorn main:app --reload
```

And the frontend:

```sh
cd frontend
npm run dev
```

In the browser:

1. Open Settings, pick *The Hype Woman*, fill in the headline and notes.
2. Save a journal entry, click "Talk it through with the coach".
3. Watch the Network tab on the backend's `/coach/turn` request — payload should include `coaching_style: "hype-woman"` and the `user_context` you typed.
4. Read the coach's reply: it should *sound* different from a `trusted-mentor` response. (This is the qualitative check that automated tests can't make.)

If the reply still sounds like *Trusted Mentor*, common causes:

- The `COACH_STYLE_FRAGMENTS["hype-woman"]` string is too tame — make it more characterful and try again.
- The base prompt's "communication style" instructions are overpowering the fragment. The base says things like *"Mirror their energy"* — that's already pretty open, so the model should follow the fragment, but if you find it stuck, you can lift voice instructions out of `COACH_TURN_SYSTEM_PROMPT` into the per-style fragments.

---

## What you'll have learned by the end

- Validating closed enums with `Literal` types in Pydantic, getting 422s for free.
- The "builder pattern" for prompt composition — keeping assembly testable separately from API calls.
- Dict-based dispatch as a substitute for `if/elif` chains.
- Substring-asserting tests as a brittleness-resistant alternative to prompt snapshots.
- A small lesson in import architecture: defining a shared type in the leaf module to avoid circular imports back to `main.py`.

If anything in here doesn't make sense, flag it and we'll dig in. The goal is for the *why* of every change to be clear, not just the *what*.
