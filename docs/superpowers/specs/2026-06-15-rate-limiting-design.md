# Rate Limiting (LLM service) — Design

**Date:** 2026-06-15
**Status:** Approved for implementation
**Backlog item:** Rate limiting (LLM service) — per-user daily caps, 429 handling on the frontend with a clear "you've hit today's limit" message.

## Goal

Protect against runaway Anthropic cost and abuse by capping how many AI requests a single user can make per day, and surface a calm, clear message in the UI when a user hits the cap.

## Context / constraints

- **Backend** is a stateless FastAPI service on Fly.io (`shared-cpu-1x`) that **scales to zero** (`min_machines_running = 0`, `auto_stop_machines = "stop"`). In-memory counters are therefore unreliable (lost on stop, not shared across machines).
- **All three AI endpoints are authenticated** via Supabase JWT (`get_current_user`): `/coach/turn`, `/coach/reframe`, `/generate-brag-doc`. There are **no anonymous endpoints**, so the original backlog mention of a "per-IP burst limit on anonymous endpoints" does not map to anything that exists. We enforce per-authenticated-user instead.
- **Supabase Postgres** is already in the stack (`entries`, `settings` with RLS). The backend currently only *verifies* JWTs via JWKS; it does **not** yet connect to Postgres.
- Frontend path: browser → Next.js proxy route (`createProxyRoute.ts`) → FastAPI. The proxy passes upstream status codes straight through, so a `429` from FastAPI reaches the browser unchanged.

## Decisions

| Question | Decision |
|---|---|
| Cap model | **Request-count** caps (not token caps) — simplest correct option. |
| Counter store | **Supabase Postgres** — durable, already in stack, doubles as the future cost-tracking foundation. |
| Limit windows | **Daily per-user only** (UTC calendar day). No monthly cap, no burst window. |
| Cap scope | **Per-endpoint** daily caps. |
| Failure mode | **Fail open** — if the counter store is unreachable, allow the request and log a warning. |

### Caps (per user, per UTC day)

| Endpoint | Cap |
|---|---|
| `coach_turn` | 30 |
| `coach_reframe` | 3 |
| `brag_doc` | 2 |

Configurable via environment variables with these values as defaults.

## Data model

New migration `supabase/migrations/0005_usage_counters.sql`:

```sql
create table public.usage_counters (
  user_id   uuid not null references auth.users(id) on delete cascade,
  endpoint  text not null,          -- 'coach_turn' | 'coach_reframe' | 'brag_doc'
  day       date not null,          -- UTC calendar day
  count     int  not null default 0,
  primary key (user_id, endpoint, day)
);

alter table public.usage_counters enable row level security;
-- No policies: only the service role (which bypasses RLS) touches this table.
-- Regular authenticated users can neither read nor modify their counters.
```

Atomic check-then-increment RPC (same migration), `security definer` so it runs with
the table owner's rights regardless of the caller:

```sql
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

  -- Lock the row for this user/endpoint/day so concurrent requests serialise.
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
```

- Blocked requests do **not** increment (check happens before increment).
- The `for update` row lock makes concurrent requests for the same user/endpoint/day serialise, so the cap is correct under concurrency.

## Backend enforcement

New module `backend/rate_limit.py`:

- Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (new env vars) and a per-endpoint cap config (env-overridable defaults above).
- Calls the RPC via **`httpx`** (already a dependency) against PostgREST:
  `POST {SUPABASE_URL}/rest/v1/rpc/increment_usage` with the service-role key in
  `apikey` + `Authorization` headers, body `{p_user_id, p_endpoint, p_day, p_limit}`.
- Exposes a FastAPI **dependency factory**: `enforce_rate_limit(endpoint: str)` returning a
  dependency that itself depends on `get_current_user`, so it has the `user_id`.
- Behaviour:
  - `allowed: true` → return (request proceeds).
  - `allowed: false` → raise `HTTPException(status_code=429, ...)`.
  - RPC call fails / store unreachable → **fail open**: log a warning, allow the request.
- Runs **before** the handler body, so a blocked request never reaches Anthropic.

429 response: raised via `HTTPException(status_code=429, detail={...}, headers={...})`,
so the body is FastAPI-idiomatic:

```json
{ "detail": { "error": "rate_limited", "endpoint": "coach_turn", "limit": 30 } }
```

plus a `Retry-After` header set to the number of seconds until the next UTC midnight.
The **frontend keys off the 429 status code plus the call site** (it knows whether it
called turn / reframe / brag doc), not the body — so the exact body shape is informational.

Wiring in `main.py` — each route gains one dependency, e.g.:

```python
@app.post("/coach/turn", response_model=CoachTurnResponse)
def coach_turn_route(
    body: CoachTurnRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("coach_turn")),
):
    ...
```

(Endpoint keys: `/coach/turn` → `coach_turn`, `/coach/reframe` → `coach_reframe`,
`/generate-brag-doc` → `brag_doc`.)

## Frontend 429 handling

- `src/lib/coachApi.ts`: `postJson` throws a typed `RateLimitError` (carrying the endpoint/limit)
  on `429`, instead of the generic `Error`.
- `src/components/CoachPanel.tsx`: the `error-turn` / `error-reframe` rows detect a
  `RateLimitError` and render a distinct, calm message **without a retry button**
  (retrying won't help until tomorrow).
- `src/components/BragDoc.tsx`: the existing `!response.ok` branch gets a `429` case that sets
  the limit message.
- Copy is **per-endpoint** (warm, clear, supportive per `DESIGN_GUIDELINES.md`):

  | Endpoint | Message |
  |---|---|
  | `coach_turn` | "You've hit the limit for messages to Coach today - try again tomorrow." |
  | `coach_reframe` | "You've hit the limit for reframing today - try again tomorrow." |
  | `brag_doc` | "You've hit the limit for generating brag docs today - try again tomorrow." |

## Testing (TDD: red → green → commit per step)

**Backend** (`backend/tests/test_rate_limit.py`):
- RPC returns `allowed:true` → dependency passes, handler runs.
- RPC returns `allowed:false` → `429` with body shape above and a `Retry-After` header.
- RPC call raises / non-2xx → fails open (request allowed), warning logged.
- Route-level: a `429` short-circuits **before** the Anthropic client is invoked
  (assert the mocked client was not called).

**Frontend**:
- `coachApi.test.ts`: `429` response → `RateLimitError`; non-429 errors unchanged.
- `CoachPanel.test.tsx`: a rate-limit error renders the limit message and no retry control.
- `BragDoc.test.tsx`: `429` renders the limit message.

## New environment variables

| Var | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | backend | PostgREST base URL for the RPC call. |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Service-role key (bypasses RLS) to call the RPC. |
| `RATE_LIMIT_COACH_TURN` | backend (optional) | Override default cap (30). |
| `RATE_LIMIT_COACH_REFRAME` | backend (optional) | Override default cap (3). |
| `RATE_LIMIT_BRAG_DOC` | backend (optional) | Override default cap (2). |

To document in `DEPLOY.md` / `.env.example`.

## Out of scope (explicitly)

- Token-based caps, monthly caps, per-minute burst windows.
- Cost tracking / token-usage logging (separate backlog item; this design leaves room for it
  by establishing the `usage_counters` table and service-role DB access).
- Admin dashboards, budget kill-switches.
