# Cost Tracking & Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every LLM request observable (structured JSON logs with request/user/endpoint/latency/tokens, forwarded to Axiom) and cost-tracked (per-request usage persisted to Postgres, an admin cost dashboard, and a hard global daily budget cap that disables the LLM endpoints on overage).

**Architecture:** A new `telemetry.py` module owns structured logging (JSON formatter + request-id/user-id contextvars + a Starlette middleware) and `record_llm_usage` (cost calc + structured event + best-effort PostgREST insert). A `budget.py` dependency checks the day's global spend before each LLM call. The three LLM functions return `(payload, usage)` so routes can record token usage. An `admin.py` router exposes an allowlist-gated cost summary, surfaced by a minimal Next.js `/admin` page. Forwarding to Axiom is infra (Fly log shipper) — the app only emits JSON to stdout.

**Tech Stack:** FastAPI + `httpx` + stdlib `logging` (backend), Supabase Postgres/PostgREST, Next.js 15 + React + Vitest (frontend), pytest (backend).

**Spec:** `docs/superpowers/specs/2026-06-16-cost-tracking-observability-design.md`

**Branch:** create off `main` (e.g. `feature/cost-tracking-observability`). Reuses `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` and the PostgREST-via-`httpx` pattern already in `rate_limit.py`.

---

## File Structure

- **Create** `supabase/migrations/0006_llm_usage.sql` — `llm_usage` table + 3 read RPCs (Task 1).
- **Create** `backend/telemetry.py` — pricing/cost, `LlmUsage`, JSON logging, contextvars, middleware, `record_llm_usage` (Tasks 2–5).
- **Create** `backend/tests/test_telemetry.py` (Tasks 2–5).
- **Modify** `backend/auth.py` — set `user_id_var` (Task 6).
- **Create** `backend/budget.py` + `backend/tests/test_budget.py` — `enforce_budget` dependency (Task 7).
- **Modify** `backend/coach.py`, `backend/brag_doc.py` — return `(payload, usage)` (Task 8).
- **Modify** `backend/main.py` — logging+middleware startup, `enforce_budget` on routes, record usage; **Modify** `backend/tests/test_coach.py`, `backend/tests/test_brag_doc.py` (Task 8).
- **Create** `backend/admin.py` + `backend/tests/test_admin.py`; **Modify** `backend/main.py` to mount the router (Task 9).
- **Create** `frontend/src/app/api/admin/cost/route.ts` + `.test.ts`, `frontend/src/app/admin/page.tsx` + `page.test.tsx` (Task 10).
- **Modify** `backend/.env.example`, `DEPLOY.md` (Task 11).

A note for frontend tasks: `frontend/AGENTS.md` says this is a customised Next.js — the route handler and client-component patterns used here already exist in the repo (`createProxyRoute.ts`, `sign-in/page.tsx`), so mirror those; only consult `node_modules/next/dist/docs/` if a route-handler signature is unclear.

---

## Task 1: Migration — `llm_usage` table + read RPCs

**Files:**
- Create: `supabase/migrations/0006_llm_usage.sql`

No automated migration test in this repo (per `docs/superpowers/specs/test-strategy.md`); verified by applying + manual query.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0006_llm_usage.sql`:

```sql
-- One row per LLM call, for cost tracking and the admin dashboard.
create table public.llm_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,
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

-- Budget-cap pre-check: total estimated spend for a UTC day.
create or replace function public.daily_spend_usd(p_day date)
returns numeric language sql security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0) from public.llm_usage where day = p_day;
$$;

-- Dashboard: per-day totals for the last p_days days (inclusive of today).
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

-- Only the backend (service role) may call these.
revoke execute on function public.daily_spend_usd(date) from public, anon, authenticated;
revoke execute on function public.daily_cost_series(integer) from public, anon, authenticated;
revoke execute on function public.cost_breakdown(date) from public, anon, authenticated;
grant execute on function public.daily_spend_usd(date) to service_role;
grant execute on function public.daily_cost_series(integer) to service_role;
grant execute on function public.cost_breakdown(date) to service_role;
```

- [ ] **Step 2: Apply and verify**

Run from repo root:
```bash
supabase db push
```
Expected: `0006_llm_usage` applies cleanly. (If `supabase db push` fails because the linked `byline-test` project is paused, un-pause it in the dashboard first.)

- [ ] **Step 3: Manual RPC spot-check (Supabase SQL editor; substitute a real auth.users id for :uid)**

```sql
insert into public.llm_usage (user_id, endpoint, model, input_tokens, output_tokens, cost_usd, latency_ms)
values (':uid'::uuid, 'brag_doc', 'claude-haiku-4-5-20251001', 2000, 1000, 0.007, 1200),
       (':uid'::uuid, 'coach_turn', 'claude-haiku-4-5-20251001', 1200, 150, 0.00195, 800);

select public.daily_spend_usd(current_date);          -- 0.008950
select * from public.daily_cost_series(30);            -- one row for today
select * from public.cost_breakdown(current_date);     -- two rows (brag_doc, coach_turn)

delete from public.llm_usage where day = current_date; -- cleanup
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_llm_usage.sql
git commit -m "feat: llm_usage table and cost-aggregation RPCs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: telemetry — pricing, cost, `LlmUsage`

**Files:**
- Create: `backend/telemetry.py`
- Test: `backend/tests/test_telemetry.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_telemetry.py`:

```python
import telemetry


class TestCostUsd:
    def test_haiku_known_rates(self):
        # 1,000,000 input @ $1 + 1,000,000 output @ $5 = $6.00
        assert telemetry.cost_usd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000) == 6.0

    def test_small_request(self):
        # 1200 in @ $1/M + 150 out @ $5/M = 0.0012 + 0.00075 = 0.00195
        assert telemetry.cost_usd("claude-haiku-4-5", 1200, 150) == 0.00195

    def test_unknown_model_uses_fallback_rate(self):
        # falls back to Haiku rate rather than zero-costing
        assert telemetry.cost_usd("some-future-model", 1_000_000, 0) == 1.0


class TestLlmUsage:
    def test_holds_token_counts(self):
        u = telemetry.LlmUsage(input_tokens=10, output_tokens=20)
        assert (u.input_tokens, u.output_tokens) == (10, 20)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_telemetry.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'telemetry'`.

- [ ] **Step 3: Create the module**

Create `backend/telemetry.py`:

```python
"""Structured logging and per-request LLM cost/telemetry capture."""
from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger("backend")

# USD per 1,000,000 tokens. Keyed by model id.
PRICING_USD_PER_MTOK = {
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
    "claude-haiku-4-5-20251001": {"input": 1.00, "output": 5.00},
}
_FALLBACK_RATES = {"input": 1.00, "output": 5.00}


@dataclass(frozen=True)
class LlmUsage:
    input_tokens: int
    output_tokens: int


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    rates = PRICING_USD_PER_MTOK.get(model)
    if rates is None:
        logger.warning("no pricing for model %r; using fallback rate", model)
        rates = _FALLBACK_RATES
    return round(
        input_tokens / 1_000_000 * rates["input"]
        + output_tokens / 1_000_000 * rates["output"],
        6,
    )
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_telemetry.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/telemetry.py backend/tests/test_telemetry.py
git commit -m "feat: telemetry pricing, cost_usd, and LlmUsage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: telemetry — JSON formatter, contextvars, `configure_logging`

**Files:**
- Modify: `backend/telemetry.py`
- Modify: `backend/tests/test_telemetry.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_telemetry.py`:

```python
import json
import logging


class TestJSONFormatter:
    def test_emits_core_fields_as_json(self):
        rec = logging.LogRecord("backend", logging.INFO, __file__, 1, "hello", None, None)
        out = json.loads(telemetry.JSONFormatter().format(rec))
        assert out["message"] == "hello"
        assert out["level"] == "INFO"
        assert out["logger"] == "backend"
        assert "timestamp" in out
        assert out["request_id"] is None
        assert out["user_id"] is None

    def test_includes_extra_fields(self):
        rec = logging.LogRecord("backend", logging.INFO, __file__, 1, "llm_usage", None, None)
        rec.endpoint = "coach_turn"
        rec.cost_usd = 0.002
        out = json.loads(telemetry.JSONFormatter().format(rec))
        assert out["endpoint"] == "coach_turn"
        assert out["cost_usd"] == 0.002

    def test_reflects_contextvars(self):
        token_r = telemetry.request_id_var.set("req-123")
        token_u = telemetry.user_id_var.set("user-9")
        try:
            rec = logging.LogRecord("backend", logging.INFO, __file__, 1, "x", None, None)
            out = json.loads(telemetry.JSONFormatter().format(rec))
            assert out["request_id"] == "req-123"
            assert out["user_id"] == "user-9"
        finally:
            telemetry.request_id_var.reset(token_r)
            telemetry.user_id_var.reset(token_u)


class TestConfigureLogging:
    def test_installs_single_json_handler_on_backend_logger(self):
        telemetry.configure_logging()
        backend_logger = logging.getLogger("backend")
        assert len(backend_logger.handlers) == 1
        assert isinstance(backend_logger.handlers[0].formatter, telemetry.JSONFormatter)
        assert backend_logger.propagate is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_telemetry.py -k "JSONFormatter or ConfigureLogging" -v`
Expected: FAIL — `JSONFormatter` / `configure_logging` / `request_id_var` not defined.

- [ ] **Step 3: Implement**

Add to `backend/telemetry.py` (after the imports, extend them; add below `cost_usd`):

```python
import contextvars
import json
from datetime import datetime, timezone

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)
user_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "user_id", default=None
)

# Attributes always present on a LogRecord; everything else is treated as an extra.
_RESERVED = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "taskName", "message", "asctime",
}


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
            "user_id": user_id_var.get(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and key not in payload:
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    backend_logger = logging.getLogger("backend")
    backend_logger.handlers = [handler]
    backend_logger.setLevel(logging.INFO)
    backend_logger.propagate = False
```

Note: `configure_logging()` sets `propagate = False`, so tests that assert on emitted `backend` logs attach their own handler (shown in later tasks) rather than relying on pytest's `caplog`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_telemetry.py -v`
Expected: PASS (all telemetry tests so far).

- [ ] **Step 5: Commit**

```bash
git add backend/telemetry.py backend/tests/test_telemetry.py
git commit -m "feat: JSON log formatter, request/user contextvars, configure_logging

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: telemetry — request-context middleware

**Files:**
- Modify: `backend/telemetry.py`
- Modify: `backend/tests/test_telemetry.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_telemetry.py`:

```python
from fastapi import FastAPI
from fastapi.testclient import TestClient


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record):
        self.records.append(record)


class TestRequestContextMiddleware:
    def test_sets_request_id_header_and_emits_access_log(self):
        app = FastAPI()
        app.add_middleware(telemetry.RequestContextMiddleware)

        @app.get("/ping")
        def ping():
            return {"ok": True}

        handler = _ListHandler()
        backend_logger = logging.getLogger("backend")
        backend_logger.addHandler(handler)
        try:
            resp = TestClient(app).get("/ping")
        finally:
            backend_logger.removeHandler(handler)

        assert resp.status_code == 200
        assert resp.headers["X-Request-ID"]
        access = [r for r in handler.records if getattr(r, "event", None) == "access"]
        assert len(access) == 1
        assert access[0].method == "GET"
        assert access[0].path == "/ping"
        assert access[0].status_code == 200
        assert isinstance(access[0].latency_ms, int)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_telemetry.py -k RequestContextMiddleware -v`
Expected: FAIL — `RequestContextMiddleware` not defined.

- [ ] **Step 3: Implement**

Add to `backend/telemetry.py` (extend imports with `time`, `uuid`, and the Starlette base middleware):

```python
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = uuid.uuid4().hex
        request_id_var.set(request_id)
        user_id_var.set(None)
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = int((time.perf_counter() - start) * 1000)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "access",
            extra={
                "event": "access",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
            },
        )
        return response
```

(Note: `request_id` set here propagates *into* the route's context, so route-level logs carry it. `user_id_var` set by the route's auth dependency is visible to route-level logs but not necessarily back here — the access log's `user_id` is best-effort; the authoritative user_id is on the `llm_usage` event in Task 5.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_telemetry.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/telemetry.py backend/tests/test_telemetry.py
git commit -m "feat: request-context middleware (request id, latency, access log)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: telemetry — `record_llm_usage`

**Files:**
- Modify: `backend/telemetry.py`
- Modify: `backend/tests/test_telemetry.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_telemetry.py`:

```python
from unittest.mock import MagicMock

import httpx
import pytest


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")


class TestRecordLlmUsage:
    def test_noops_persistence_when_unconfigured_but_logs_event(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        post = MagicMock()
        monkeypatch.setattr(telemetry.httpx, "post", post)

        handler = _ListHandler()
        logging.getLogger("backend").addHandler(handler)
        try:
            telemetry.record_llm_usage("u1", "coach_turn", "claude-haiku-4-5", 1200, 150, 800)
        finally:
            logging.getLogger("backend").removeHandler(handler)

        post.assert_not_called()
        events = [r for r in handler.records if getattr(r, "event", None) == "llm_usage"]
        assert len(events) == 1
        assert events[0].cost_usd == 0.00195
        assert events[0].endpoint == "coach_turn"

    def test_posts_row_when_configured(self, monkeypatch, configured):
        post = MagicMock(return_value=MagicMock(raise_for_status=lambda: None))
        monkeypatch.setattr(telemetry.httpx, "post", post)
        token = telemetry.request_id_var.set("req-xyz")
        try:
            telemetry.record_llm_usage("u1", "brag_doc", "claude-haiku-4-5", 2000, 1000, 1200)
        finally:
            telemetry.request_id_var.reset(token)

        url = post.call_args.args[0]
        body = post.call_args.kwargs["json"]
        headers = post.call_args.kwargs["headers"]
        assert url.endswith("/rest/v1/llm_usage")
        assert body["endpoint"] == "brag_doc"
        assert body["input_tokens"] == 2000
        assert body["cost_usd"] == telemetry.cost_usd("claude-haiku-4-5", 2000, 1000)
        assert body["request_id"] == "req-xyz"
        assert headers["apikey"] == "service-key"

    def test_fails_open_on_http_error(self, monkeypatch, configured):
        def boom(*a, **k):
            raise httpx.ConnectError("down")
        monkeypatch.setattr(telemetry.httpx, "post", boom)
        # Must not raise.
        telemetry.record_llm_usage("u1", "coach_turn", "claude-haiku-4-5", 10, 20, 5)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_telemetry.py -k RecordLlmUsage -v`
Expected: FAIL — `record_llm_usage` not defined (and `telemetry.httpx` missing).

- [ ] **Step 3: Implement**

Add to `backend/telemetry.py` (extend imports with `os` and `httpx`):

```python
import os

import httpx


def record_llm_usage(
    user_id: str,
    endpoint: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
) -> None:
    """Emit a structured llm_usage event and best-effort persist a row.

    Never raises into the request path: the model call already succeeded.
    """
    cost = cost_usd(model, input_tokens, output_tokens)
    logger.info(
        "llm_usage",
        extra={
            "event": "llm_usage",
            "endpoint": endpoint,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost,
            "latency_ms": latency_ms,
        },
    )
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return
    try:
        resp = httpx.post(
            f"{url}/rest/v1/llm_usage",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "user_id": user_id,
                "endpoint": endpoint,
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": cost,
                "latency_ms": latency_ms,
                "request_id": request_id_var.get(),
            },
            timeout=5.0,
        )
        resp.raise_for_status()
    except Exception:
        logger.warning("failed to persist llm_usage; continuing", exc_info=True)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_telemetry.py -v`
Expected: PASS (all telemetry tests).

- [ ] **Step 5: Commit**

```bash
git add backend/telemetry.py backend/tests/test_telemetry.py
git commit -m "feat: record_llm_usage (cost + structured event + best-effort persist)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: auth — populate `user_id_var`

**Files:**
- Modify: `backend/auth.py`
- Modify: `backend/tests/test_auth.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_auth.py`:

```python
def test_get_current_user_sets_user_id_contextvar(monkeypatch):
    import auth
    import telemetry
    from fastapi.security import HTTPAuthorizationCredentials

    monkeypatch.setattr(auth, "_verify", lambda token: {"sub": "user-42", "email": "a@b.com"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="tok")

    token = telemetry.user_id_var.set(None)
    try:
        # request arg is unused by get_current_user beyond DI; pass a dummy.
        auth.get_current_user(request=None, credentials=creds)
        assert telemetry.user_id_var.get() == "user-42"
    finally:
        telemetry.user_id_var.reset(token)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_auth.py::test_get_current_user_sets_user_id_contextvar -v`
Expected: FAIL — `user_id_var` stays `None` (auth doesn't set it yet).

- [ ] **Step 3: Implement**

In `backend/auth.py`, add the import near the top:
```python
from telemetry import user_id_var
```
Then in `get_current_user`, immediately after `user_id` is validated (after the `if not user_id: raise ...` check), add:
```python
    user_id_var.set(user_id)
```
so the function reads:
```python
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="invalid token")
    user_id_var.set(user_id)
    return UserClaims(user_id=user_id, email=claims.get("email"))
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_auth.py -v`
Expected: PASS (new test + existing auth tests).

- [ ] **Step 5: Commit**

```bash
git add backend/auth.py backend/tests/test_auth.py
git commit -m "feat: set user_id contextvar on authentication

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: budget — `enforce_budget` dependency

**Files:**
- Create: `backend/budget.py`
- Test: `backend/tests/test_budget.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_budget.py`:

```python
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import HTTPException

import budget


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")


class TestDailyBudget:
    def test_default_is_5(self, monkeypatch):
        monkeypatch.delenv("DAILY_BUDGET_USD", raising=False)
        assert budget._daily_budget_usd() == 5.0

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("DAILY_BUDGET_USD", "2.50")
        assert budget._daily_budget_usd() == 2.5


class TestSecondsUntilMidnight:
    def test_never_zero(self):
        from datetime import datetime, timezone
        midnight = datetime(2026, 6, 16, 0, 0, 0, tzinfo=timezone.utc)
        assert budget._seconds_until_utc_midnight(midnight) >= 1


class TestEnforceBudget:
    def test_allows_under_cap(self, monkeypatch):
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: 1.0)
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")
        budget.enforce_budget()  # no raise

    def test_blocks_at_or_over_cap(self, monkeypatch):
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: 5.0)
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")
        with pytest.raises(HTTPException) as exc:
            budget.enforce_budget()
        assert exc.value.status_code == 503
        assert exc.value.detail["error"] == "budget_exceeded"
        assert "Retry-After" in exc.value.headers

    def test_fails_open_when_spend_unknown(self, monkeypatch):
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: None)
        budget.enforce_budget()  # no raise

    def test_daily_spend_returns_none_when_unconfigured(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        assert budget._daily_spend_usd() is None

    def test_daily_spend_parses_rpc_scalar(self, monkeypatch, configured):
        resp = MagicMock(raise_for_status=lambda: None, json=lambda: 3.5)
        monkeypatch.setattr(budget.httpx, "post", MagicMock(return_value=resp))
        assert budget._daily_spend_usd() == 3.5

    def test_daily_spend_fails_open_on_error(self, monkeypatch, configured):
        def boom(*a, **k):
            raise httpx.ConnectError("down")
        monkeypatch.setattr(budget.httpx, "post", boom)
        assert budget._daily_spend_usd() is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_budget.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'budget'`.

- [ ] **Step 3: Create the module**

Create `backend/budget.py`:

```python
"""Global daily spend cap. Disables the LLM endpoints once the day's estimated
cost exceeds DAILY_BUDGET_USD. Fails open if the spend store is unavailable."""
from __future__ import annotations

import logging
import os
from datetime import datetime, time, timedelta, timezone

import httpx
from fastapi import HTTPException

logger = logging.getLogger("backend")


def _daily_budget_usd() -> float:
    return float(os.environ.get("DAILY_BUDGET_USD", "5.00"))


def _seconds_until_utc_midnight(now: datetime) -> int:
    tomorrow = now.date() + timedelta(days=1)
    midnight = datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)
    return max(1, int((midnight - now).total_seconds()))


def _daily_spend_usd() -> float | None:
    """Today's estimated spend, or None if the store is unavailable (fail open)."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("budget store not configured; failing open")
        return None
    day = datetime.now(timezone.utc).date().isoformat()
    try:
        resp = httpx.post(
            f"{url}/rest/v1/rpc/daily_spend_usd",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={"p_day": day},
            timeout=5.0,
        )
        resp.raise_for_status()
        return float(resp.json())
    except Exception:
        logger.warning("budget check failed; failing open", exc_info=True)
        return None


def enforce_budget() -> None:
    """FastAPI dependency: 503 if today's spend has reached the daily cap."""
    spend = _daily_spend_usd()
    if spend is None:
        return  # fail open
    budget = _daily_budget_usd()
    if spend >= budget:
        raise HTTPException(
            status_code=503,
            detail={"error": "budget_exceeded", "budget_usd": budget},
            headers={
                "Retry-After": str(
                    _seconds_until_utc_midnight(datetime.now(timezone.utc))
                )
            },
        )
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_budget.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/budget.py backend/tests/test_budget.py
git commit -m "feat: global daily budget cap dependency (fail-open)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Wire capture + budget into the request path

**Files:**
- Modify: `backend/coach.py`, `backend/brag_doc.py` (return `(payload, usage)`)
- Modify: `backend/main.py` (logging+middleware startup, `enforce_budget`, unpack usage, record)
- Modify: `backend/tests/test_coach.py`, `backend/tests/test_brag_doc.py`

- [ ] **Step 1: Write the failing tests**

(a) In `backend/tests/test_brag_doc.py`, update `_mock_text_response` to include usage:
```python
def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)],
        usage=MagicMock(input_tokens=2000, output_tokens=1000),
    )
```
Then append:
```python
class TestBragDocTelemetry:
    def test_records_usage_on_success(self, mock_client, http_client, authed_user, monkeypatch):
        import main
        recorded = {}
        monkeypatch.setattr(
            main, "record_llm_usage",
            lambda **kw: recorded.update(kw),
        )
        _mock_text_response(mock_client, '{"bullets": []}')

        _post(http_client, {"entries": []})

        assert recorded["endpoint"] == "brag_doc"
        assert recorded["input_tokens"] == 2000
        assert recorded["output_tokens"] == 1000
        assert recorded["user_id"] == "test-user"

    def test_blocks_when_over_budget_before_calling_anthropic(
        self, mock_client, http_client, authed_user, monkeypatch
    ):
        import budget
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: 999.0)
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")

        response = _post(http_client, {"entries": []})

        assert response.status_code == 503
        assert response.json()["detail"]["error"] == "budget_exceeded"
        mock_client.messages.create.assert_not_called()
```

(b) In `backend/tests/test_coach.py`, update `_mock_text_response` the same way:
```python
def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)],
        usage=MagicMock(input_tokens=1200, output_tokens=150),
    )
```
Then append:
```python
class TestCoachTelemetry:
    def test_turn_records_usage_on_success(self, mock_client, http_client, authed_user, monkeypatch):
        import main
        recorded = {}
        monkeypatch.setattr(main, "record_llm_usage", lambda **kw: recorded.update(kw))
        _mock_text_response(mock_client, json.dumps({"text": "ok", "notes": []}))

        http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert recorded["endpoint"] == "coach_turn"
        assert recorded["input_tokens"] == 1200

    def test_turn_blocks_when_over_budget(self, mock_client, http_client, authed_user, monkeypatch):
        import budget
        monkeypatch.setattr(budget, "_daily_spend_usd", lambda: 999.0)
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")

        response = http_client.post("/coach/turn", json=SAMPLE_TURN_BODY)

        assert response.status_code == 503
        mock_client.messages.create.assert_not_called()
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_brag_doc.py::TestBragDocTelemetry tests/test_coach.py::TestCoachTelemetry -v`
Expected: FAIL — `main.record_llm_usage` doesn't exist; budget not wired (no 503); usage not recorded.

- [ ] **Step 3a: Make the domain functions return `(payload, usage)`**

In `backend/brag_doc.py`, add to the imports:
```python
from telemetry import LlmUsage
```
Replace the end of `generate_brag_doc` (the canary check + return) with:
```python
    if canary_leaked(raw, canary):
        raise OutputGuardrailError("system token leaked in brag doc output")
    usage = LlmUsage(
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
    )
    return parse_model_json(raw), usage
```

In `backend/coach.py`, add to the imports:
```python
from telemetry import LlmUsage
```
In **`coach_turn`**, replace its canary check + return with:
```python
    if canary_leaked(raw, canary):
        raise OutputGuardrailError("system token leaked in coach turn output")
    usage = LlmUsage(
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
    )
    return parse_model_json(raw), usage
```
In **`coach_reframe`**, replace its canary check + return with:
```python
    if canary_leaked(raw, canary):
        raise OutputGuardrailError("system token leaked in coach reframe output")
    usage = LlmUsage(
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
    )
    return parse_model_json(raw), usage
```

- [ ] **Step 3b: Wire `main.py`**

In `backend/main.py`:

Update imports/top:
```python
import logging
import time

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Literal

from auth import get_current_user, UserClaims
from brag_doc import GroupBy, generate_brag_doc
from budget import enforce_budget
from coach import Message, UserContext, coach_reframe, coach_turn
from rate_limit import enforce_rate_limit
from telemetry import RequestContextMiddleware, configure_logging, record_llm_usage
from utils import MODEL, OutputGuardrailError

load_dotenv()
configure_logging()

logger = logging.getLogger("backend")
```
Right after `app = FastAPI(title="Confidence Journal Backend")`:
```python
app.add_middleware(RequestContextMiddleware)
```

Rewrite the three route bodies to add the budget dependency, time the call, unpack usage, and record. **`brag_doc_route`:**
```python
@app.post("/generate-brag-doc", response_model=BragDocResponse)
def brag_doc_route(
    body: BragDocRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("brag_doc")),
    _budget: None = Depends(enforce_budget),
):
    logger.info("brag doc request", extra={"endpoint": "brag_doc"})
    start = time.perf_counter()
    try:
        result, usage = generate_brag_doc(
            entries=[e.model_dump() for e in body.entries],
            group_by=body.groupBy,
            user_prompt=body.userPrompt,
            user_context=body.user_context,
            client=client,
        )
    except OutputGuardrailError:
        logger.warning("brag doc output guardrail tripped", extra={"endpoint": "brag_doc"})
        return JSONResponse(status_code=500, content={"error": "Brag doc generation failed"})
    except Exception:
        logger.exception("brag doc generation failed")
        return JSONResponse(status_code=500, content={"error": "Brag doc generation failed"})
    record_llm_usage(
        user_id=user.user_id, endpoint="brag_doc", model=MODEL,
        input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
        latency_ms=int((time.perf_counter() - start) * 1000),
    )
    return result
```
**`coach_turn_route`:**
```python
@app.post("/coach/turn", response_model=CoachTurnResponse)
def coach_turn_route(
    body: CoachTurnRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("coach_turn")),
    _budget: None = Depends(enforce_budget),
):
    logger.info("coach turn request", extra={"endpoint": "coach_turn"})
    start = time.perf_counter()
    try:
        result, usage = coach_turn(
            entry_text=body.entry_text, prompt=body.prompt, tags=body.tags,
            conversation=body.conversation, coaching_style=body.coaching_style,
            user_context=body.user_context, client=client,
        )
    except OutputGuardrailError:
        logger.warning("coach turn output guardrail tripped", extra={"endpoint": "coach_turn"})
        return CoachTurnResponse(text=COACH_FALLBACK_TEXT, notes=[])
    except Exception:
        logger.exception("coach turn call failed")
        return JSONResponse(status_code=500, content={"error": "Coach turn failed"})
    record_llm_usage(
        user_id=user.user_id, endpoint="coach_turn", model=MODEL,
        input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
        latency_ms=int((time.perf_counter() - start) * 1000),
    )
    return CoachTurnResponse(text=result["text"], notes=result["notes"])
```
**`coach_reframe_route`:**
```python
@app.post("/coach/reframe", response_model=CoachReframeResponse)
def coach_reframe_route(
    body: CoachReframeRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("coach_reframe")),
    _budget: None = Depends(enforce_budget),
):
    logger.info("coach reframe request", extra={"endpoint": "coach_reframe"})
    start = time.perf_counter()
    try:
        result, usage = coach_reframe(
            entry_text=body.entry_text, prompt=body.prompt, tags=body.tags,
            conversation=body.conversation, coaching_style=body.coaching_style,
            user_context=body.user_context, client=client,
        )
    except OutputGuardrailError:
        logger.warning("coach reframe output guardrail tripped", extra={"endpoint": "coach_reframe"})
        return CoachReframeResponse(reframed=COACH_FALLBACK_TEXT, notes=[])
    except Exception:
        logger.exception("coach reframe call failed")
        return JSONResponse(status_code=500, content={"error": "Coach reframe failed"})
    record_llm_usage(
        user_id=user.user_id, endpoint="coach_reframe", model=MODEL,
        input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
        latency_ms=int((time.perf_counter() - start) * 1000),
    )
    return CoachReframeResponse(reframed=result["reframed"], notes=result["notes"])
```

- [ ] **Step 4: Run the new tests, then the full suite**

Run: `cd backend && uv run pytest tests/test_brag_doc.py tests/test_coach.py -v`
Expected: PASS (new telemetry tests + all existing route tests — existing tests pass because budget + persistence both fail open when `SUPABASE_URL` is unset, and `_mock_text_response` now supplies token ints).
Then: `cd backend && uv run pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/coach.py backend/brag_doc.py backend/main.py backend/tests/test_coach.py backend/tests/test_brag_doc.py
git commit -m "feat: capture token usage + enforce budget on LLM routes; structured logging startup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: admin — cost summary endpoint

**Files:**
- Create: `backend/admin.py`
- Test: `backend/tests/test_admin.py`
- Modify: `backend/main.py` (mount the router)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_admin.py`:

```python
import pytest

import admin


@pytest.fixture
def fake_rpc(monkeypatch):
    calls = {}

    def _fake(name, payload):
        calls[name] = payload
        return {
            "daily_spend_usd": 1.5,
            "daily_cost_series": [{"day": "2026-06-16", "cost_usd": 1.5, "request_count": 3}],
            "cost_breakdown": [
                {"endpoint": "coach_turn", "model": "claude-haiku-4-5-20251001",
                 "cost_usd": 1.5, "request_count": 3, "input_tokens": 3600, "output_tokens": 450}
            ],
        }[name]

    monkeypatch.setattr(admin, "_rpc", _fake)
    return calls


class TestRequireAdmin:
    def test_allowlisted_email_gets_summary(self, http_client, authed_user, monkeypatch, fake_rpc):
        monkeypatch.setenv("ADMIN_EMAILS", "test@example.com, other@x.com")
        monkeypatch.setenv("DAILY_BUDGET_USD", "5.00")

        resp = http_client.get("/admin/cost/summary?days=30")

        assert resp.status_code == 200
        data = resp.json()
        assert data["budget_usd"] == 5.0
        assert data["today_spend_usd"] == 1.5
        assert data["daily"][0]["request_count"] == 3
        assert data["breakdown"][0]["endpoint"] == "coach_turn"

    def test_non_allowlisted_email_forbidden(self, http_client, authed_user, monkeypatch):
        monkeypatch.setenv("ADMIN_EMAILS", "someone-else@x.com")
        resp = http_client.get("/admin/cost/summary")
        assert resp.status_code == 403

    def test_empty_allowlist_forbidden(self, http_client, authed_user, monkeypatch):
        monkeypatch.delenv("ADMIN_EMAILS", raising=False)
        resp = http_client.get("/admin/cost/summary")
        assert resp.status_code == 403

    def test_days_out_of_bounds_rejected(self, http_client, authed_user, monkeypatch, fake_rpc):
        monkeypatch.setenv("ADMIN_EMAILS", "test@example.com")
        assert http_client.get("/admin/cost/summary?days=0").status_code == 422
        assert http_client.get("/admin/cost/summary?days=500").status_code == 422
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && uv run pytest tests/test_admin.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'admin'` (and the route isn't mounted yet).

- [ ] **Step 3a: Create the module**

Create `backend/admin.py`:

```python
"""Admin cost dashboard API, gated by an email allowlist."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from auth import UserClaims, get_current_user
from budget import _daily_budget_usd

admin_router = APIRouter(prefix="/admin")


def _admin_emails() -> set[str]:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def require_admin(user: UserClaims = Depends(get_current_user)) -> UserClaims:
    if (user.email or "").lower() not in _admin_emails():
        raise HTTPException(status_code=403, detail="forbidden")
    return user


def _rpc(name: str, payload: dict):
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    resp = httpx.post(
        f"{url}/rest/v1/rpc/{name}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()


@admin_router.get("/cost/summary")
def cost_summary(
    days: int = Query(30, ge=1, le=365),
    _admin: UserClaims = Depends(require_admin),
):
    today = datetime.now(timezone.utc).date()
    since = (today - timedelta(days=days - 1)).isoformat()
    return {
        "budget_usd": _daily_budget_usd(),
        "today_spend_usd": float(_rpc("daily_spend_usd", {"p_day": today.isoformat()})),
        "daily": _rpc("daily_cost_series", {"p_days": days}),
        "breakdown": _rpc("cost_breakdown", {"p_since": since}),
    }
```

- [ ] **Step 3b: Mount the router in `main.py`**

Add the import alongside the others:
```python
from admin import admin_router
```
After `app.add_middleware(RequestContextMiddleware)`:
```python
app.include_router(admin_router)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && uv run pytest tests/test_admin.py -v`
Expected: PASS.
Then full suite: `cd backend && uv run pytest -q` — all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/admin.py backend/tests/test_admin.py backend/main.py
git commit -m "feat: admin cost summary endpoint (email-allowlist gated)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Frontend — admin cost proxy + dashboard page

**Files:**
- Create: `frontend/src/app/api/admin/cost/route.ts` + `frontend/src/app/api/admin/cost/route.test.ts`
- Create: `frontend/src/app/admin/page.tsx` + `frontend/src/app/admin/page.test.tsx`

(`createProxyRoute` is POST-only; the admin endpoint is a GET, so this adds a small GET proxy mirroring it.)

- [ ] **Step 1: Write the failing route test**

Create `frontend/src/app/api/admin/cost/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const ORIGINAL_FETCH = global.fetch;

function mockSession(accessToken: string | null) {
  vi.mocked(getSupabaseServerClient).mockResolvedValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: accessToken ? { access_token: accessToken } : null },
      }),
    },
  } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);
}

beforeEach(() => {
  vi.stubEnv("PYTHON_SERVICE_URL", "http://test-python:8000");
  mockSession("test-token");
});
afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/admin/cost (proxy)", () => {
  it("forwards to the backend with the bearer token and the days param", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ budget_usd: 5 }), { status: 200 })
    );
    global.fetch = fetchMock;

    const res = await GET(new Request("http://app/api/admin/cost?days=7"));

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://test-python:8000/admin/cost/summary?days=7");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("passes a backend 403 through unchanged", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const res = await GET(new Request("http://app/api/admin/cost"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when there is no session", async () => {
    mockSession(null);
    const res = await GET(new Request("http://app/api/admin/cost"));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/app/api/admin/cost/route.test.ts`
Expected: FAIL — `./route` has no `GET` export.

- [ ] **Step 3: Implement the GET proxy**

Create `frontend/src/app/api/admin/cost/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return new NextResponse("unauthorized", { status: 401 });
    }

    const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
    const days = new URL(request.url).searchParams.get("days") ?? "30";
    try {
      const upstream = await fetch(
        `${pythonUrl}/admin/cost/summary?days=${encodeURIComponent(days)}`,
        { method: "GET", headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const text = await upstream.text();
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("admin cost proxy failed to reach Python service", error);
      return NextResponse.json({ error: "Failed to load cost summary" }, { status: 502 });
    }
  } catch (error) {
    console.error("admin cost proxy handler failed", error);
    return NextResponse.json({ error: "Failed to load cost summary" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run to verify the route test passes**

Run: `cd frontend && npx vitest run src/app/api/admin/cost/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing page test**

Create `frontend/src/app/admin/page.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AdminCostPage from "./page";

const ORIGINAL_FETCH = global.fetch;
afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.clearAllMocks();
});

const SUMMARY = {
  budget_usd: 5,
  today_spend_usd: 1.25,
  daily: [{ day: "2026-06-16", cost_usd: 1.25, request_count: 4 }],
  breakdown: [
    { endpoint: "coach_turn", model: "claude-haiku-4-5-20251001",
      cost_usd: 1.25, request_count: 4, input_tokens: 4800, output_tokens: 600 },
  ],
};

describe("AdminCostPage", () => {
  it("renders today's spend, budget, and the breakdown", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SUMMARY), { status: 200 })
    );
    render(<AdminCostPage />);
    // $1.25 and $5.00 each appear in several nested rows, so assert with
    // getAllByText; use unambiguous strings for the breakdown + daily rows.
    await waitFor(() => expect(screen.getByText("coach_turn")).toBeInTheDocument());
    expect(screen.getByText("claude-haiku-4-5-20251001")).toBeInTheDocument();
    expect(screen.getByText("2026-06-16")).toBeInTheDocument();
    expect(screen.getAllByText(/\$1\.25/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$5\.00/).length).toBeGreaterThan(0);
  });

  it("shows Not authorized on 403", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    render(<AdminCostPage />);
    await waitFor(() =>
      expect(screen.getByText(/not authorized/i)).toBeInTheDocument()
    );
  });

  it("shows an error message when the request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    render(<AdminCostPage />);
    await waitFor(() =>
      expect(screen.getByText(/could not load/i)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd frontend && npx vitest run src/app/admin/page.test.tsx`
Expected: FAIL — `./page` does not exist.

- [ ] **Step 7: Implement the page**

Create `frontend/src/app/admin/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface DailyRow {
  day: string;
  cost_usd: number;
  request_count: number;
}
interface BreakdownRow {
  endpoint: string;
  model: string;
  cost_usd: number;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
}
interface CostSummary {
  budget_usd: number;
  today_spend_usd: number;
  daily: DailyRow[];
  breakdown: BreakdownRow[];
}

type State =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error" }
  | { kind: "ready"; data: CostSummary };

const usd = (n: number) => `$${n.toFixed(2)}`;

export default function AdminCostPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/admin/cost?days=30")
      .then(async (r) => {
        if (r.status === 403) return setState({ kind: "forbidden" });
        if (!r.ok) return setState({ kind: "error" });
        setState({ kind: "ready", data: (await r.json()) as CostSummary });
      })
      .catch(() => setState({ kind: "error" }));
  }, []);

  if (state.kind === "loading")
    return <main className="max-w-[800px] mx-auto p-8 font-body">Loading…</main>;
  if (state.kind === "forbidden")
    return <main className="max-w-[800px] mx-auto p-8 font-body">Not authorized</main>;
  if (state.kind === "error")
    return (
      <main className="max-w-[800px] mx-auto p-8 font-body">
        Could not load cost summary.
      </main>
    );

  const d = state.data;
  const pct = d.budget_usd > 0 ? Math.min(100, (d.today_spend_usd / d.budget_usd) * 100) : 0;

  return (
    <main className="max-w-[800px] mx-auto p-8 font-body text-[var(--color-neutral-700)]">
      <h1 className="font-display text-3xl text-[var(--color-neutral-800)] mb-6">Cost</h1>

      <section className="mb-10">
        <p className="text-sm text-[var(--color-neutral-500)] mb-1">Today</p>
        <p className="text-2xl font-display text-[var(--color-neutral-800)]">
          {usd(d.today_spend_usd)} <span className="text-base text-[var(--color-neutral-500)]">/ {usd(d.budget_usd)}</span>
        </p>
        <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-neutral-200)]">
          <div
            className="h-2 rounded-full bg-[var(--color-primary-500)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl text-[var(--color-neutral-800)] mb-3">Last 30 days</h2>
        <ul className="text-sm">
          {d.daily.map((row) => (
            <li key={row.day} className="flex justify-between py-1 border-b border-[var(--color-neutral-200)]">
              <span>{row.day}</span>
              <span>{usd(row.cost_usd)} · {row.request_count} reqs</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-[var(--color-neutral-800)] mb-3">By endpoint &amp; model</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-neutral-500)]">
              <th className="py-1">Endpoint</th><th>Model</th><th className="text-right">Cost</th><th className="text-right">Reqs</th>
            </tr>
          </thead>
          <tbody>
            {d.breakdown.map((row) => (
              <tr key={`${row.endpoint}-${row.model}`} className="border-t border-[var(--color-neutral-200)]">
                <td className="py-1">{row.endpoint}</td>
                <td>{row.model}</td>
                <td className="text-right">{usd(row.cost_usd)}</td>
                <td className="text-right">{row.request_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Run to verify page tests pass, then the full frontend suite**

Run: `cd frontend && npx vitest run src/app/admin/page.test.tsx src/app/api/admin/cost/route.test.ts`
Expected: PASS.
Then: `cd frontend && npx vitest run` — all pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/api/admin/cost frontend/src/app/admin
git commit -m "feat: admin cost dashboard page + GET proxy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Docs + final verification

**Files:**
- Modify: `backend/.env.example`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add env vars to `backend/.env.example`**

Append:
```
# Global daily spend cap in USD (default 5.00 if unset)
DAILY_BUDGET_USD=
# Comma-separated admin emails allowed to view the cost dashboard
ADMIN_EMAILS=
```

- [ ] **Step 2: Document in `DEPLOY.md`**

(a) In the `## Secrets` section, add a subsection after the rate-limiting secrets block:
```
### Cost tracking / admin dashboard

```bash
fly secrets set DAILY_BUDGET_USD='5.00' ADMIN_EMAILS='you@example.com' --app byline-api
fly secrets set DAILY_BUDGET_USD='5.00' ADMIN_EMAILS='you@example.com' --app byline-api-staging
```

`DAILY_BUDGET_USD` is the service-wide daily spend ceiling; once a day's estimated LLM cost reaches it, the AI endpoints return 503 until the next UTC day (fails open if the spend store is unreachable). `ADMIN_EMAILS` gates the `/admin` cost dashboard. Requires migration `0006_llm_usage` applied (see "Apply a new DB migration to prod").
```
(Use real triple-backtick fences in the file.)

(b) Add a new top-level section:
```
## Log forwarding (Axiom)

The backend emits structured JSON logs to stdout (one object per line: request id, user id, endpoint, latency, token usage, cost). Forwarding is done at the infra layer so the request path never depends on the log vendor.

1. Create an Axiom dataset (e.g. `byline`) and an API token with ingest permission.
2. Deploy the community fly-log-shipper, configured for the Axiom sink:

```bash
git clone https://github.com/superfly/fly-log-shipper && cd fly-log-shipper
fly launch --no-deploy
fly secrets set ORG=<your-fly-org> ACCESS_TOKEN=<fly-api-token> \
  AXIOM_TOKEN=<axiom-ingest-token> AXIOM_DATASET=byline --app <shipper-app-name>
fly deploy
```

The shipper reads the org's logs (including `byline-api`) and forwards them to Axiom. No application redeploy is needed; if Axiom is down, the API is unaffected.
```
(Use real triple-backtick fences.)

- [ ] **Step 3: Run the full backend suite**

Run: `cd backend && uv run pytest -q`
Expected: all pass.

- [ ] **Step 4: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example DEPLOY.md
git commit -m "docs: cost-tracking env vars and Axiom log forwarding

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verification checklist (end of plan)

- [ ] Migration `0006` applied; manual RPC spot-check returns expected values; `anon`/`authenticated` cannot execute the RPCs.
- [ ] `cd backend && uv run pytest -q` — all green.
- [ ] `cd frontend && npx vitest run` — all green.
- [ ] With `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset, AI endpoints still work (budget + persistence fail open).
- [ ] Manual smoke (configured env): generate a brag doc → a row appears in `llm_usage`; hit `/admin` as an allowlisted email → see today's spend + breakdown; as a non-allowlisted email → "Not authorized".
- [ ] Set `DAILY_BUDGET_USD` very low, exceed it, confirm the AI endpoints return 503 with `Retry-After`.
- [ ] After deploying fly-log-shipper, confirm structured `llm_usage` / `access` events arrive in Axiom.
