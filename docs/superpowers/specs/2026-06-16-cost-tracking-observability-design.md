# Cost Tracking & Observability — Design

**Date:** 2026-06-16
**Status:** Approved for implementation
**Backlog items:**
- Cost tracking — log token usage per request (input + output, per user, per endpoint, per model). Daily cost dashboard for admin. Hard budget cap that disables LLM endpoints on overage.
- Observability — structured logs on the FastAPI service (request ID, user ID, endpoint, latency, token usage). Forward to a log destination (Logtail / Axiom / similar).

## Goal

Make every LLM request observable (structured logs with request/user/endpoint/latency/tokens, forwarded to Axiom) and cost-tracked (per-request usage persisted to Postgres, an admin cost dashboard, and a hard daily budget cap that disables the LLM endpoints when the day's spend is exceeded).

## Context / constraints

- Backend is a stateless FastAPI service on Fly.io that scales to zero. It already verifies Supabase JWTs and, from the rate-limiting work, has `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and a PostgREST-via-`httpx` pattern (`rate_limit.py`) plus a service-role-only `usage_counters` table.
- **Token usage is currently discarded** — the three LLM functions (`coach_turn`, `coach_reframe`, `generate_brag_doc`) return only parsed content; `message.usage` is never read.
- Logging is plain stdlib `logging` to stdout (caught by `fly logs`), unstructured, no request IDs, no latency, no forwarding.
- Model is `claude-haiku-4-5-20251001` (Haiku 4.5: $1 / $5 per 1M input / output tokens).
- Frontend is Next.js; the browser → Next proxy (`createProxyRoute.ts`) → FastAPI pattern is established and passes upstream status codes through.

## Decisions

| Question | Decision |
|---|---|
| Scope | All six pieces in one spec: telemetry capture, structured logs, Axiom forwarding, Postgres persistence, budget cap, admin dashboard. |
| Budget cap | **Global daily $ cap** (UTC day). Default `DAILY_BUDGET_USD = 5.00`, env-overridable. |
| Budget-cap failure mode | **Fail open** on counter-store error (consistent with rate limiting — availability over enforcement during a brief outage). |
| Dashboard gating | **Email allowlist** (`ADMIN_EMAILS` env), checked against the verified JWT email. |
| Dashboard richness | **Minimal**: today vs budget, 30-day daily totals, breakdown by endpoint + model. |
| Structured logging | **stdlib `logging` + a small JSON formatter** (no heavy new dependency). JSON to stdout. |
| Log forwarding | **Axiom**, via the infra-layer `fly-log-shipper` (app stays vendor-agnostic; no request-path dependency on the sink). |
| Pricing | Hardcoded per-model table in code; cost = input + output only (no cache pricing — app doesn't use prompt caching). |
| Latency recorded | `llm_usage.latency_ms` = duration of the model call (domain function); access-log middleware separately records whole-request latency. |

## A. Data model

New migration `supabase/migrations/0006_llm_usage.sql`:

```sql
create table public.llm_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,  -- keep cost history if user deleted
  endpoint      text not null,        -- 'coach_turn' | 'coach_reframe' | 'brag_doc'
  model         text not null,
  input_tokens  int  not null,
  output_tokens int  not null,
  cost_usd      numeric(12,6) not null,
  latency_ms    int  not null,
  request_id    text,
  day           date not null default (now() at time zone 'utc')::date,
  created_at    timestamptz not null default now()
);
create index llm_usage_day_idx on public.llm_usage (day);

alter table public.llm_usage enable row level security;
-- No policies: only the service role (which bypasses RLS) reads/writes this table.
```

`security definer` RPCs (service-role only; `revoke execute ... from public, anon, authenticated; grant ... to service_role`), mirroring `increment_usage`:

```sql
-- Budget-cap pre-check: total estimated spend for a UTC day.
create or replace function public.daily_spend_usd(p_day date)
returns numeric language sql security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0) from public.llm_usage where day = p_day;
$$;

-- Dashboard: per-day totals for the last p_days days.
create or replace function public.daily_cost_series(p_days int)
returns table (day date, cost_usd numeric, request_count bigint)
language sql security definer set search_path = public as $$
  select day, sum(cost_usd) as cost_usd, count(*) as request_count
  from public.llm_usage
  where day >= (current_date - (p_days - 1))
  group by day order by day;
$$;

-- Dashboard: breakdown by endpoint + model since a date.
create or replace function public.cost_breakdown(p_since date)
returns table (endpoint text, model text, cost_usd numeric, request_count bigint,
               input_tokens bigint, output_tokens bigint)
language sql security definer set search_path = public as $$
  select endpoint, model, sum(cost_usd) as cost_usd, count(*) as request_count,
         sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
  from public.llm_usage
  where day >= p_since
  group by endpoint, model order by cost_usd desc;
$$;
```

Rows are **inserted directly via PostgREST** (`POST /rest/v1/llm_usage`) with the service-role key — no insert RPC needed.

## B. Observability core — `backend/telemetry.py`

- **Pricing + cost:**
  ```python
  PRICING_USD_PER_MTOK = {
      "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
      "claude-haiku-4-5-20251001": {"input": 1.00, "output": 5.00},
  }
  def cost_usd(model, input_tokens, output_tokens) -> float: ...
  ```
  Unknown model → falls back to the Haiku rate and logs a warning (so a model swap doesn't silently zero-cost).
- **JSON logging:** a `JSONFormatter(logging.Formatter)` renders each record as one JSON object: `timestamp, level, logger, message, request_id, user_id`, plus any `extra` fields. `configure_logging()` attaches it to the `backend` logger (stdout) and is called once at app startup.
- **Context:** `request_id_var` and `user_id_var` (`contextvars.ContextVar`). The formatter reads both so *every* log line (including existing guardrail/rate-limit warnings) carries them when set.
- **Middleware** (`RequestContextMiddleware`, Starlette `BaseHTTPMiddleware`): assigns a `request_id` (uuid hex) into `request_id_var`, times the request, sets the `X-Request-ID` response header, and emits one structured `access` log: `request_id, method, path, status_code, latency_ms`.
- **`record_llm_usage(user_id, endpoint, model, input_tokens, output_tokens, latency_ms)`:** computes `cost_usd`, emits a structured `llm_usage` log event (all fields + `request_id` from the contextvar), and inserts a row into `llm_usage` via `httpx` PostgREST with the service-role key. **Best-effort / fail-open:** if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset or the insert fails, it logs a warning and returns — it never raises into the request path (the model call already succeeded).

`auth.py`: `get_current_user` sets `user_id_var` (one added line) so logs carry the user once authenticated.

## C. Budget cap — `backend/budget.py`

- `DAILY_BUDGET_USD` from env (default `5.00`).
- **`enforce_budget()`** FastAPI dependency (global — no per-endpoint arg): calls `daily_spend_usd(today)` via `httpx` PostgREST; if the returned total `>= DAILY_BUDGET_USD`, raises `HTTPException(503, detail={"error": "budget_exceeded"}, headers={"Retry-After": <secs to next UTC midnight>})`. Runs **before** the handler body, so a blocked request never reaches Anthropic. **Fails open** (logs a warning, allows the request) if the store is unreachable/unconfigured.
- The cap is checked *before* the call against spend-so-far and the new cost is recorded *after*, so the daily total can overshoot by at most one request's cost.

## D. Capture wiring — `backend/main.py` + the three functions

- `coach_turn`, `coach_reframe`, `generate_brag_doc` change their return to `(payload, usage)`, where `usage` is a small dataclass `LlmUsage(input_tokens: int, output_tokens: int)` read from `message.usage`. The domain functions stay free of telemetry side-effects.
- Each route:
  - adds `Depends(enforce_budget)` alongside the existing `Depends(enforce_rate_limit(...))`;
  - times the function call (`time.perf_counter()`), unpacks `(result, usage)`, builds the response, then calls `record_llm_usage(user_id=user.user_id, endpoint=<key>, model=MODEL, input_tokens=usage.input_tokens, output_tokens=usage.output_tokens, latency_ms=...)`.
- Output-guardrail / fallback paths (canary trip, model error) still record nothing on failure beyond the existing logs — usage is recorded only on a successful model response. (A guardrail-tripped response still consumed tokens; recording that is a possible later refinement, noted as out of scope.)
- `app` startup calls `configure_logging()` and registers `RequestContextMiddleware`.

## E. Admin API + dashboard

**Backend — `backend/admin.py`:**
- `ADMIN_EMAILS` env (comma-separated). `require_admin(user = Depends(get_current_user))` → `403` unless `user.email` is in the allowlist (case-insensitive, trimmed).
- `GET /admin/cost/summary?days=30` (default 30, bounded 1–365) → returns:
  ```json
  {
    "budget_usd": 5.0,
    "today_spend_usd": 1.23,
    "daily": [{"day": "2026-06-16", "cost_usd": 1.23, "request_count": 42}, ...],
    "breakdown": [{"endpoint": "coach_turn", "model": "claude-haiku-4-5-20251001",
                   "cost_usd": 0.9, "request_count": 30,
                   "input_tokens": 36000, "output_tokens": 4500}, ...]
  }
  ```
  Reads `daily_spend_usd`, `daily_cost_series`, `cost_breakdown` via PostgREST. Registered on `app` via an admin router.

**Frontend:**
- `/api/admin/cost` Next proxy route (reuses the `createProxyRoute` session-check + forward pattern, GET) → backend `GET /admin/cost/summary`.
- `/admin` page (client component): fetches the summary on load. On `403` renders a plain "Not authorized" message; on success renders:
  - today's spend vs budget (with a simple bar/percentage),
  - a 30-day daily totals list/mini-bar,
  - the endpoint × model breakdown table.
  Minimal styling per `DESIGN_GUIDELINES.md`. **No nav link** — it's an internal tool reached by navigating to `/admin` directly.

## F. Log forwarding — Axiom (infra/ops)

The app only emits structured JSON to stdout. Forwarding is set up at the infra layer and documented in `DEPLOY.md`:
- Deploy the community **`fly-log-shipper`** app, configured for the Axiom sink with `AXIOM_TOKEN` and `AXIOM_DATASET` (Fly secrets on the shipper app), pointed at the org's logs.
- No application code or request-path dependency on Axiom; if Axiom is down, the app is unaffected.
- `DEPLOY.md` gains a "Log forwarding (Axiom)" section with the shipper setup and the secrets; `.env.example` documents the new backend env vars (`DAILY_BUDGET_USD`, `ADMIN_EMAILS`).

## G. Testing (TDD: red → green → commit)

**Backend:**
- `telemetry`: `cost_usd` math for known token counts; unknown-model fallback + warning; `JSONFormatter` produces parseable JSON containing `request_id`/`user_id`/`extra`; `record_llm_usage` no-ops the insert when unconfigured (fail open) and posts the correct PostgREST payload + computed cost when configured (mock `httpx`); request-id middleware sets `X-Request-ID` and emits an `access` log.
- `budget`: `enforce_budget` allows under cap, raises `503` + `Retry-After` over cap (mock RPC), fails open on error; route-level test that a 503 short-circuits **before** the Anthropic client is called (`mock_client.messages.create.assert_not_called()`), for each endpoint.
- `admin`: `require_admin` 403 for non-allowlisted / 200 for allowlisted; `/admin/cost/summary` response shape (mock RPCs); `days` bounds validation.
- route capture: each LLM route records usage exactly once on success (assert `record_llm_usage` called with the right endpoint/model/tokens via monkeypatch).
- The shared `_mock_text_response` helpers in `test_coach.py` / `test_brag_doc.py` gain `usage=MagicMock(input_tokens=…, output_tokens=…)` (one line each) so existing route tests keep passing with real token ints.

**Frontend:** `/admin` page renders the summary; shows "Not authorized" on 403; proxy route forwards with the session token and passes status through.

**Migration:** manual apply (`supabase db push`) + spot-check — insert a couple of `llm_usage` rows, verify `daily_spend_usd`, `daily_cost_series`, `cost_breakdown` return expected values; confirm `anon`/`authenticated` cannot execute the RPCs.

## New environment variables

| Var | Where | Purpose |
|---|---|---|
| `DAILY_BUDGET_USD` | backend (optional) | Global daily spend cap. Default `5.00`. |
| `ADMIN_EMAILS` | backend | Comma-separated admin email allowlist for the cost dashboard. |
| `AXIOM_TOKEN`, `AXIOM_DATASET` | fly-log-shipper app | Axiom ingestion (infra, not the API app). |

(`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` already exist from rate limiting and are reused.)

## Out of scope (explicitly)

- Per-user or monthly budget caps (global daily only this round).
- Recording token usage for failed / guardrail-tripped responses.
- Prompt-cache token pricing.
- Alerting/paging on budget thresholds (the cap is the only automated reaction).
- A richer dashboard (charts, per-user breakdown, date-range filter) and an admin nav entry.
