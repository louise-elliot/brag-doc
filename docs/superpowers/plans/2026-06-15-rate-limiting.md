# Rate Limiting (LLM service) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap AI requests per user per day (per endpoint) in the FastAPI backend, backed by a durable Postgres counter, and show a clear per-feature "you've hit today's limit" message in the UI.

**Architecture:** A new `usage_counters` Postgres table plus an atomic `increment_usage` RPC do check-then-increment. The FastAPI backend calls that RPC via PostgREST (using `httpx` + the service-role key) through a `enforce_rate_limit(endpoint)` dependency that runs before each AI route — so a blocked request never reaches Anthropic. On `429`, the Next.js proxy passes the status through, and the frontend renders a per-endpoint limit message. If the counter store is unreachable, the backend fails open.

**Tech Stack:** FastAPI + `httpx` (backend), Supabase Postgres / PostgREST, Next.js 15 + React + Vitest (frontend), pytest (backend).

**Spec:** `docs/superpowers/specs/2026-06-15-rate-limiting-design.md`

**Caps (per user, per UTC day):** `coach_turn` = 30, `coach_reframe` = 3, `brag_doc` = 2.

---

## File Structure

- **Create** `supabase/migrations/0005_usage_counters.sql` — table + RPC (Task 1).
- **Create** `backend/rate_limit.py` — limits config, RPC client, FastAPI dependency (Task 2).
- **Create** `backend/tests/test_rate_limit.py` — unit tests for the module (Task 2).
- **Modify** `backend/main.py` — add the dependency to the three AI routes (Task 3).
- **Modify** `backend/tests/test_rate_limit.py` — add route-level short-circuit tests (Task 3).
- **Modify** `frontend/src/lib/coachApi.ts` — `RateLimitError` + 429 handling in `postJson` (Task 4).
- **Modify** `frontend/src/lib/coachApi.test.ts` — 429 tests (Task 4).
- **Modify** `frontend/src/components/CoachPanel.tsx` — limit phases + `LimitRow` (Task 5).
- **Modify** `frontend/src/components/CoachPanel.test.tsx` — limit-message tests (Task 5).
- **Modify** `frontend/src/components/BragDoc.tsx` — 429 message branch (Task 6).
- **Modify** `frontend/src/components/BragDoc.test.tsx` — 429 test (Task 6).
- **Modify** `backend/.env.example`, `DEPLOY.md` — document new env vars (Task 7).

---

## Task 1: Postgres counter table + atomic increment RPC

**Files:**
- Create: `supabase/migrations/0005_usage_counters.sql`

There is no automated migration test in this repo (see `docs/superpowers/specs/test-strategy.md` — DB layer is tested via the data layer/RLS, not migration files), so this task is verified by applying the migration and running a manual query.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0005_usage_counters.sql`:

```sql
-- Per-user, per-endpoint, per-day request counters for rate limiting.
create table public.usage_counters (
  user_id   uuid not null references auth.users(id) on delete cascade,
  endpoint  text not null,          -- 'coach_turn' | 'coach_reframe' | 'brag_doc'
  day       date not null,          -- UTC calendar day
  count     int  not null default 0,
  primary key (user_id, endpoint, day)
);

alter table public.usage_counters enable row level security;
-- No policies: only the service role (which bypasses RLS) touches this table.

-- Atomic check-then-increment. Returns whether the request is allowed (i.e. the
-- count was below p_limit) and the resulting count. Blocked requests do NOT increment.
create or replace function public.increment_usage(
  p_user_id  uuid,
  p_endpoint text,
  p_day      date,
  p_limit    int
)
returns table (allowed boolean, count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.usage_counters (user_id, endpoint, day, count)
  values (p_user_id, p_endpoint, p_day, 0)
  on conflict (user_id, endpoint, day) do nothing;

  select c.count into v_count
  from public.usage_counters c
  where c.user_id = p_user_id and c.endpoint = p_endpoint and c.day = p_day
  for update;

  if v_count >= p_limit then
    return query select false, v_count;
    return;
  end if;

  update public.usage_counters c
  set count = c.count + 1
  where c.user_id = p_user_id and c.endpoint = p_endpoint and c.day = p_day
  returning c.count into v_count;

  return query select true, v_count;
end;
$$;

-- Only the backend (service role) may call this. Prevent users invoking it directly.
revoke execute on function public.increment_usage(uuid, text, date, int) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, text, date, int) to service_role;
```

- [ ] **Step 2: Apply the migration locally and verify**

Run (from repo root):
```bash
supabase db push
```
Expected: migration `0005_usage_counters` applies with no error.

> Note (from project memory): if `supabase db push` fails because the linked `byline-test` project is paused, un-pause it in the Supabase dashboard first, then retry.

- [ ] **Step 3: Manually verify the RPC enforces the limit**

Run via the Supabase SQL editor or `psql` (substitute any real `auth.users` id for `:uid`):
```sql
select * from public.increment_usage(':uid'::uuid, 'brag_doc', current_date, 2); -- allowed=t count=1
select * from public.increment_usage(':uid'::uuid, 'brag_doc', current_date, 2); -- allowed=t count=2
select * from public.increment_usage(':uid'::uuid, 'brag_doc', current_date, 2); -- allowed=f count=2
-- cleanup
delete from public.usage_counters where endpoint = 'brag_doc' and day = current_date;
```
Expected: third call returns `allowed = false` and `count` stays at 2.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_usage_counters.sql
git commit -m "feat: usage_counters table and increment_usage RPC for rate limiting"
```

---

## Task 2: Backend rate-limit module

**Files:**
- Create: `backend/rate_limit.py`
- Test: `backend/tests/test_rate_limit.py`

The module exposes `enforce_rate_limit(endpoint)` (a FastAPI dependency factory) plus
internal helpers. Tests monkeypatch the module-level `httpx.post` and `os.environ`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_rate_limit.py`:

```python
from unittest.mock import MagicMock

import httpx
import pytest

import rate_limit


def _rpc_response(allowed: bool, count: int) -> MagicMock:
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = [{"allowed": allowed, "count": count}]
    return resp


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")


class TestLimitFor:
    def test_returns_default_when_env_absent(self, monkeypatch):
        monkeypatch.delenv("RATE_LIMIT_COACH_TURN", raising=False)
        assert rate_limit._limit_for("coach_turn") == 30
        assert rate_limit._limit_for("coach_reframe") == 3
        assert rate_limit._limit_for("brag_doc") == 2

    def test_env_overrides_default(self, monkeypatch):
        monkeypatch.setenv("RATE_LIMIT_BRAG_DOC", "9")
        assert rate_limit._limit_for("brag_doc") == 9


class TestSecondsUntilUtcMidnight:
    def test_returns_seconds_to_next_midnight(self):
        from datetime import datetime, timezone
        now = datetime(2026, 6, 15, 23, 59, 0, tzinfo=timezone.utc)
        assert rate_limit._seconds_until_utc_midnight(now) == 60

    def test_never_returns_zero_or_negative(self):
        from datetime import datetime, timezone
        midnight = datetime(2026, 6, 15, 0, 0, 0, tzinfo=timezone.utc)
        assert rate_limit._seconds_until_utc_midnight(midnight) >= 1


class TestCheckAndIncrement:
    def test_allows_when_rpc_allows(self, monkeypatch, configured):
        post = MagicMock(return_value=_rpc_response(True, 1))
        monkeypatch.setattr(rate_limit.httpx, "post", post)
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is True
        assert post.call_count == 1

    def test_blocks_when_rpc_disallows(self, monkeypatch, configured):
        monkeypatch.setattr(
            rate_limit.httpx, "post", MagicMock(return_value=_rpc_response(False, 2))
        )
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is False

    def test_fails_open_when_not_configured(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        post = MagicMock()
        monkeypatch.setattr(rate_limit.httpx, "post", post)
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is True
        post.assert_not_called()

    def test_fails_open_on_http_error(self, monkeypatch, configured):
        def boom(*args, **kwargs):
            raise httpx.ConnectError("down")
        monkeypatch.setattr(rate_limit.httpx, "post", boom)
        assert rate_limit._check_and_increment("user-1", "brag_doc", 2) is True

    def test_sends_expected_rpc_payload(self, monkeypatch, configured):
        post = MagicMock(return_value=_rpc_response(True, 1))
        monkeypatch.setattr(rate_limit.httpx, "post", post)
        rate_limit._check_and_increment("user-1", "coach_turn", 30)
        url = post.call_args.args[0]
        body = post.call_args.kwargs["json"]
        headers = post.call_args.kwargs["headers"]
        assert url.endswith("/rest/v1/rpc/increment_usage")
        assert body["p_user_id"] == "user-1"
        assert body["p_endpoint"] == "coach_turn"
        assert body["p_limit"] == 30
        assert headers["apikey"] == "service-key"
        assert headers["Authorization"] == "Bearer service-key"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_rate_limit.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'rate_limit'`.

- [ ] **Step 3: Write the module**

Create `backend/rate_limit.py`:

```python
"""Per-user, per-endpoint daily rate limiting backed by a Postgres counter.

Enforcement happens in the backend (the trust boundary that holds the Anthropic
key). Counters live in Supabase Postgres and are checked/incremented atomically
via the `increment_usage` RPC. If the store is unreachable, we fail open.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, time, timedelta, timezone

import httpx
from fastapi import Depends, HTTPException

from auth import UserClaims, get_current_user

logger = logging.getLogger("backend")

DEFAULT_LIMITS = {
    "coach_turn": 30,
    "coach_reframe": 3,
    "brag_doc": 2,
}

_ENV_KEYS = {
    "coach_turn": "RATE_LIMIT_COACH_TURN",
    "coach_reframe": "RATE_LIMIT_COACH_REFRAME",
    "brag_doc": "RATE_LIMIT_BRAG_DOC",
}


def _limit_for(endpoint: str) -> int:
    return int(os.environ.get(_ENV_KEYS[endpoint], DEFAULT_LIMITS[endpoint]))


def _seconds_until_utc_midnight(now: datetime) -> int:
    tomorrow = now.date() + timedelta(days=1)
    midnight = datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)
    return max(1, int((midnight - now).total_seconds()))


def _check_and_increment(user_id: str, endpoint: str, limit: int) -> bool:
    """Return True if the request is allowed. Fails open (True) on any error."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("rate limit store not configured; failing open")
        return True
    day = datetime.now(timezone.utc).date().isoformat()
    try:
        resp = httpx.post(
            f"{url}/rest/v1/rpc/increment_usage",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "p_user_id": user_id,
                "p_endpoint": endpoint,
                "p_day": day,
                "p_limit": limit,
            },
            timeout=5.0,
        )
        resp.raise_for_status()
        rows = resp.json()
        row = rows[0] if isinstance(rows, list) else rows
        return bool(row["allowed"])
    except Exception:
        logger.warning("rate limit check failed; failing open", exc_info=True)
        return True


def enforce_rate_limit(endpoint: str):
    """Return a FastAPI dependency that enforces the daily cap for `endpoint`."""

    def dependency(user: UserClaims = Depends(get_current_user)) -> None:
        limit = _limit_for(endpoint)
        if not _check_and_increment(user.user_id, endpoint, limit):
            raise HTTPException(
                status_code=429,
                detail={"error": "rate_limited", "endpoint": endpoint, "limit": limit},
                headers={
                    "Retry-After": str(
                        _seconds_until_utc_midnight(datetime.now(timezone.utc))
                    )
                },
            )

    return dependency
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_rate_limit.py -v`
Expected: PASS (all tests in `test_rate_limit.py`).

- [ ] **Step 5: Commit**

```bash
git add backend/rate_limit.py backend/tests/test_rate_limit.py
git commit -m "feat: backend rate-limit module with fail-open Postgres RPC check"
```

---

## Task 3: Wire the dependency into the AI routes

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_rate_limit.py`

- [ ] **Step 1: Write the failing route-level tests**

Append to `backend/tests/test_rate_limit.py` (the `http_client` / `mock_client` / `authed_user` fixtures from `conftest.py` build the app; no extra import of `app` is needed):

```python
SAMPLE_TURN_BODY = {
    "entry_text": "Led the migration",
    "prompt": "What did you ship?",
    "tags": ["technical"],
    "conversation": [],
}
SAMPLE_REFRAME_BODY = {**SAMPLE_TURN_BODY, "conversation": []}
SAMPLE_BRAG_BODY = {
    "entries": [
        {
            "id": "1",
            "date": "2026-06-15",
            "prompt": "p",
            "original": "did a thing",
            "reframed": None,
            "tags": ["technical"],
            "createdAt": "2026-06-15T10:00:00Z",
        }
    ]
}


class TestRouteEnforcement:
    @pytest.mark.parametrize(
        "path,body,endpoint",
        [
            ("/coach/turn", SAMPLE_TURN_BODY, "coach_turn"),
            ("/coach/reframe", SAMPLE_REFRAME_BODY, "coach_reframe"),
            ("/generate-brag-doc", SAMPLE_BRAG_BODY, "brag_doc"),
        ],
    )
    def test_returns_429_and_skips_anthropic_when_blocked(
        self, monkeypatch, mock_client, http_client, authed_user, path, body, endpoint
    ):
        monkeypatch.setattr(
            rate_limit, "_check_and_increment", lambda *a, **k: False
        )

        response = http_client.post(path, json=body)

        assert response.status_code == 429
        assert response.headers["Retry-After"]
        assert response.json()["detail"]["endpoint"] == endpoint
        mock_client.messages.create.assert_not_called()

    def test_allows_request_through_when_not_blocked(
        self, monkeypatch, mock_client, http_client, authed_user
    ):
        import json
        monkeypatch.setattr(rate_limit, "_check_and_increment", lambda *a, **k: True)
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(type="text", text=json.dumps({"text": "ok", "notes": []}))]
        )

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 200
        mock_client.messages.create.assert_called_once()
```

Note: `mock_client`, `http_client`, `authed_user` come from `backend/tests/conftest.py`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_rate_limit.py::TestRouteEnforcement -v`
Expected: FAIL — the `429` tests fail because the routes don't enforce yet (they call Anthropic / return 200), so `assert response.status_code == 429` fails and `assert_not_called` fails.

- [ ] **Step 3: Add the dependency to each AI route in `main.py`**

Add the import near the other flat imports (after `from coach import ...`):

```python
from rate_limit import enforce_rate_limit
```

Then add one parameter to each of the three route functions. For `/generate-brag-doc`:

```python
@app.post("/generate-brag-doc", response_model=BragDocResponse)
def brag_doc_route(
    body: BragDocRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("brag_doc")),
):
```

For `/coach/turn`:

```python
@app.post("/coach/turn", response_model=CoachTurnResponse)
def coach_turn_route(
    body: CoachTurnRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("coach_turn")),
):
```

For `/coach/reframe`:

```python
@app.post("/coach/reframe", response_model=CoachReframeResponse)
def coach_reframe_route(
    body: CoachReframeRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("coach_reframe")),
):
```

Leave the bodies of all three functions unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_rate_limit.py -v`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite to confirm no regressions**

Run: `cd backend && uv run pytest -v`
Expected: PASS. (Existing `test_coach.py` / `test_brag_doc.py` tests don't set `SUPABASE_URL`, so `_check_and_increment` fails open and they are unaffected.)

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_rate_limit.py
git commit -m "feat: enforce per-endpoint daily rate limits on AI routes"
```

---

## Task 4: Frontend `RateLimitError` + 429 handling in the API client

**Files:**
- Modify: `frontend/src/lib/coachApi.ts`
- Modify: `frontend/src/lib/coachApi.test.ts`

> Before editing Next.js code, heed `frontend/AGENTS.md`: this is a customised Next.js — check `node_modules/next/dist/docs/` before writing anything Next.js-specific. (This task touches only plain TS/fetch, no Next.js APIs.)

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/coachApi.test.ts` (and add `RateLimitError` to the import on line 2: `import { coachTurn, coachReframe, RateLimitError, type CoachMessage } from "./coachApi";`):

```typescript
  it("coachTurn throws RateLimitError on 429", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: { error: "rate_limited" } }),
        { status: 429 }
      )
    );

    await expect(coachTurn(sampleArgs)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("coachReframe throws RateLimitError on 429", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: { error: "rate_limited" } }),
        { status: 429 }
      )
    );

    await expect(coachReframe(sampleArgs)).rejects.toBeInstanceOf(RateLimitError);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/coachApi.test.ts`
Expected: FAIL — `RateLimitError` is not exported (import error / `rejects.toBeInstanceOf` fails).

- [ ] **Step 3: Implement `RateLimitError` and the 429 branch**

In `frontend/src/lib/coachApi.ts`, add the error class above `postJson` (after the interfaces, before line 39):

```typescript
export class RateLimitError extends Error {
  constructor() {
    super("rate limited");
    this.name = "RateLimitError";
  }
}
```

Then update `postJson` to check for 429 before the generic `!response.ok` branch:

```typescript
async function postJson<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 429) {
    throw new RateLimitError();
  }
  if (!response.ok) {
    throw new Error(`${url} failed with status ${response.status}`);
  }
  return response.json() as Promise<TRes>;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/coachApi.test.ts`
Expected: PASS (new 429 tests plus the existing ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/coachApi.ts frontend/src/lib/coachApi.test.ts
git commit -m "feat: throw RateLimitError on 429 in coach API client"
```

---

## Task 5: CoachPanel limit messages

**Files:**
- Modify: `frontend/src/components/CoachPanel.tsx`
- Modify: `frontend/src/components/CoachPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/CoachPanel.test.tsx` a new describe block (it already imports `coachApi`, `render`, `screen`, `waitFor`, `vi`, `baseEntry`):

```typescript
describe("CoachPanel — rate limit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSettings = { ...DEFAULT_USER_SETTINGS };
  });

  it("shows the coach limit message when the first turn is rate limited", async () => {
    vi.spyOn(coachApi, "coachTurn").mockRejectedValueOnce(
      new coachApi.RateLimitError()
    );

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
        screen.getByText(
          "You've hit the limit for messages to Coach today - try again tomorrow."
        )
      ).toBeInTheDocument()
    );
    // No retry button in the limit state.
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows the reframe limit message when reframe is rate limited", async () => {
    vi.spyOn(coachApi, "coachTurn").mockResolvedValueOnce({
      text: "Who benefited?",
      notes: [],
    });
    vi.spyOn(coachApi, "coachReframe").mockRejectedValueOnce(
      new coachApi.RateLimitError()
    );

    render(
      <CoachPanel
        entry={baseEntry}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const reframeBtn = await screen.findByRole("button", { name: "Reframe it now" });
    await userEvent.click(reframeBtn);

    await waitFor(() =>
      expect(
        screen.getByText(
          "You've hit the limit for reframing today - try again tomorrow."
        )
      ).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/CoachPanel.test.tsx`
Expected: FAIL — the limit messages are not rendered (the component shows the generic `ErrorRow` "Coach didn't respond" text instead).

- [ ] **Step 3: Implement the limit phases**

In `frontend/src/components/CoachPanel.tsx`:

(a) Update the `coachReframe`/`coachTurn` import to also pull in `RateLimitError`:

```typescript
import {
  coachReframe,
  coachTurn,
  RateLimitError,
  type CoachMessage as ApiMessage,
} from "@/lib/coachApi";
```

(b) Add two phases to the `Phase` union:

```typescript
type Phase =
  | { kind: "loading-turn" }
  | { kind: "chatting" }
  | { kind: "error-turn" }
  | { kind: "limit-turn" }
  | { kind: "loading-reframe" }
  | { kind: "reframing"; reframed: string; notes: string[] }
  | { kind: "error-reframe" }
  | { kind: "limit-reframe" };
```

(c) In `fetchTurn`, replace the `catch {` block:

```typescript
    } catch (e) {
      setPhase({ kind: e instanceof RateLimitError ? "limit-turn" : "error-turn" });
    }
```

(d) In `fetchReframe`, replace the `catch {` block:

```typescript
    } catch (e) {
      setPhase({
        kind: e instanceof RateLimitError ? "limit-reframe" : "error-reframe",
      });
    }
```

(e) In the render, after the two `ErrorRow` lines (after the `error-reframe` block, before the closing `</div>` of the messages container), add:

```typescript
        {phase.kind === "limit-turn" && (
          <LimitRow message="You've hit the limit for messages to Coach today - try again tomorrow." />
        )}

        {phase.kind === "limit-reframe" && (
          <LimitRow message="You've hit the limit for reframing today - try again tomorrow." />
        )}
```

(f) Add the `LimitRow` component at the bottom of the file, next to `ErrorRow`:

```typescript
interface LimitRowProps {
  message: string;
}

function LimitRow({ message }: LimitRowProps) {
  return (
    <div
      role="alert"
      className="font-body text-sm text-[var(--color-neutral-600)]"
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/CoachPanel.test.tsx`
Expected: PASS (new rate-limit tests plus all existing CoachPanel tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CoachPanel.tsx frontend/src/components/CoachPanel.test.tsx
git commit -m "feat: show per-feature limit messages in CoachPanel on 429"
```

---

## Task 6: BragDoc 429 message

**Files:**
- Modify: `frontend/src/components/BragDoc.tsx`
- Modify: `frontend/src/components/BragDoc.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe` block that contains the "displays generated bullets" test (the one whose `beforeEach` calls `vi.restoreAllMocks()`). It uses the file's existing `renderBragDoc()` helper, `userEvent`, `screen`, and `waitFor` (all already imported), and mirrors the existing fetch-mock shape — a plain object with `ok`/`status`/`json`, not a `Response`:

```typescript
  it("shows the brag-doc limit message on 429", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ detail: { error: "rate_limited" } }),
    });

    renderBragDoc();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "You've hit the limit for generating brag docs today - try again tomorrow."
        )
      ).toBeInTheDocument()
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/BragDoc.test.tsx`
Expected: FAIL — on 429 the component currently shows "Failed to generate brag doc. Please try again." instead of the limit message.

- [ ] **Step 3: Add the 429 branch in `generate()`**

In `frontend/src/components/BragDoc.tsx`, in `generate()`, replace the `if (!response.ok)` block (lines ~144-147) with a 429-specific branch first:

```typescript
      if (response.status === 429) {
        setError(
          "You've hit the limit for generating brag docs today - try again tomorrow."
        );
        return;
      }

      if (!response.ok) {
        setError("Failed to generate brag doc. Please try again.");
        return;
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/BragDoc.test.tsx`
Expected: PASS (new 429 test plus existing BragDoc tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BragDoc.tsx frontend/src/components/BragDoc.test.tsx
git commit -m "feat: show brag-doc limit message on 429"
```

---

## Task 7: Document env vars + final verification

**Files:**
- Modify: `backend/.env.example`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add the new env vars to `backend/.env.example`**

Append:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Optional per-endpoint daily caps (defaults: 30 / 3 / 2)
RATE_LIMIT_COACH_TURN=
RATE_LIMIT_COACH_REFRAME=
RATE_LIMIT_BRAG_DOC=
```

- [ ] **Step 2: Document the env vars and Fly secrets in `DEPLOY.md`**

Open `DEPLOY.md`, find the section that lists backend environment/secrets, and add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required for rate limiting) plus the optional `RATE_LIMIT_*` overrides, in the same format the file already uses for `ANTHROPIC_API_KEY` / Fly secrets. Match the existing wording and structure — do not invent a new format.

- [ ] **Step 3: Run the full backend test suite**

Run: `cd backend && uv run pytest -v`
Expected: PASS.

- [ ] **Step 4: Run the full frontend unit suite**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example DEPLOY.md
git commit -m "docs: document rate-limiting env vars and Fly secrets"
```

---

## Verification checklist (end of plan)

- [ ] Migration `0005` applied; manual RPC check blocks the 3rd `brag_doc` call.
- [ ] `cd backend && uv run pytest -v` — all green.
- [ ] `cd frontend && npx vitest run` — all green.
- [ ] With `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` unset, AI endpoints still work (fail open).
- [ ] Manual smoke (optional, needs configured env): exceed `brag_doc` (2/day) and confirm the UI shows "You've hit the limit for generating brag docs today - try again tomorrow."
