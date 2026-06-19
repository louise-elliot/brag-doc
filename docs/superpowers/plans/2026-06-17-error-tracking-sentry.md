# Error Tracking with Sentry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture unexpected runtime errors from the Byline frontend (Next.js/Vercel) and backend (FastAPI/Fly) in Sentry, in production only, with strict scrubbing so no journal content ever leaves the app.

**Architecture:** Backend initializes the Sentry Python SDK only when `SENTRY_DSN` is set, and explicitly captures exceptions at the three existing `except Exception` blocks in `main.py` (guardrail trips excluded). Frontend uses `@sentry/nextjs` with instrumentation files gated on `VERCEL_ENV === "production"`, explicit capture at the two proxy-route catch blocks, and source-map upload via `withSentryConfig`.

**Tech Stack:** FastAPI + `sentry-sdk[fastapi]` (Python 3.12, uv); Next.js 16 + `@sentry/nextjs`; vitest; pytest.

## Global Constraints

- **Coding standards:** Keep it simple, no over-engineering, no unnecessary defensive programming, no extra features. No emojis anywhere.
- **Strict privacy:** No journal content (entry text, reframed text, coach conversation, prompts, notes) may reach Sentry. No user email — only `user_id`.
- **Production only:** Backend inits only when `SENTRY_DSN` is present; frontend inits only when `VERCEL_ENV === "production"` AND a DSN is present. Staging, PR previews, and local dev send nothing.
- **No tracing / no replay:** errors only.
- **Definition of done (whole plan):** backend `pytest`, frontend `npm run test`, `npm run lint`, and `npx tsc --noEmit` all green.
- **Git:** the user commits manually. Each task's "Commit" step gives the exact command; run it only if the user has said to commit, otherwise stop at green tests and report.

---

### Task 1: Backend Sentry init + event scrubbing

Adds the dependency and a small `sentry_setup.py` module that owns init and the scrub hook, so `main.py` stays clean and the scrubbing logic is unit-testable.

**Files:**
- Modify: `backend/pyproject.toml` (add dependency)
- Create: `backend/sentry_setup.py`
- Create: `backend/tests/test_sentry_setup.py`

**Interfaces:**
- Produces:
  - `init_sentry() -> None` — calls `sentry_sdk.init(...)` only if `SENTRY_DSN` is set; safe no-op otherwise.
  - `scrub_event(event: dict, hint: dict) -> dict` — removes the `request` block and reduces `user` to `{"id": ...}` only. Used as the `before_send` hook.
  - `capture_exception(exc: BaseException) -> None` — tags the current Sentry scope with `request_id` and sets user id from the telemetry contextvars, then forwards to `sentry_sdk.capture_exception`. No-op-safe when Sentry is uninitialized (the SDK handles this).

- [ ] **Step 1: Add the dependency**

In `backend/pyproject.toml`, add to the `dependencies` list:

```toml
    "sentry-sdk[fastapi]>=2.0.0",
```

Then run: `cd backend && uv lock && uv sync`

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_sentry_setup.py`:

```python
from unittest.mock import MagicMock, patch

from sentry_setup import init_sentry, scrub_event, capture_exception


class TestScrubEvent:
    def test_removes_request_block(self):
        event = {"request": {"data": "secret journal text"}, "level": "error"}
        result = scrub_event(event, {})
        assert "request" not in result

    def test_reduces_user_to_id_only(self):
        event = {"user": {"id": "u1", "email": "a@b.com", "username": "alice"}}
        result = scrub_event(event, {})
        assert result["user"] == {"id": "u1"}

    def test_no_user_key_is_left_untouched(self):
        event = {"level": "error"}
        result = scrub_event(event, {})
        assert "user" not in result


class TestInitSentry:
    def test_does_not_init_without_dsn(self, monkeypatch):
        monkeypatch.delenv("SENTRY_DSN", raising=False)
        with patch("sentry_setup.sentry_sdk.init") as mock_init:
            init_sentry()
            mock_init.assert_not_called()

    def test_inits_with_dsn_and_strict_privacy(self, monkeypatch):
        monkeypatch.setenv("SENTRY_DSN", "https://example@sentry.io/1")
        with patch("sentry_setup.sentry_sdk.init") as mock_init:
            init_sentry()
            mock_init.assert_called_once()
            kwargs = mock_init.call_args.kwargs
            assert kwargs["send_default_pii"] is False
            assert kwargs["include_local_variables"] is False
            assert kwargs["max_request_body_size"] == "never"
            assert kwargs["before_send"] is scrub_event


class TestCaptureException:
    def test_forwards_to_sdk(self):
        with patch("sentry_setup.sentry_sdk.capture_exception") as mock_cap:
            exc = ValueError("boom")
            capture_exception(exc)
            mock_cap.assert_called_once_with(exc)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_sentry_setup.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sentry_setup'`

- [ ] **Step 4: Write the implementation**

Create `backend/sentry_setup.py`:

```python
"""Sentry initialization and strict event scrubbing for the backend.

Production only: init is a no-op unless SENTRY_DSN is set. No journal content
or user email may reach Sentry.
"""
from __future__ import annotations

import os

import sentry_sdk

from telemetry import request_id_var, user_id_var


def scrub_event(event: dict, hint: dict) -> dict:
    """before_send hook: drop request data, reduce user to id only."""
    event.pop("request", None)
    user = event.get("user")
    if user is not None:
        event["user"] = {"id": user.get("id")}
    return event


def init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        before_send=scrub_event,
    )


def capture_exception(exc: BaseException) -> None:
    """Capture an exception, correlating it with the request log via request_id."""
    scope = sentry_sdk.get_current_scope()
    scope.set_tag("request_id", request_id_var.get())
    user_id = user_id_var.get()
    if user_id is not None:
        scope.set_user({"id": user_id})
    sentry_sdk.capture_exception(exc)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_sentry_setup.py -v`
Expected: PASS (all 7 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/sentry_setup.py backend/tests/test_sentry_setup.py
git commit -m "feat(backend): add Sentry init and strict event scrubbing"
```

---

### Task 2: Backend — init at startup + capture at route failures

Wires `init_sentry()` into app startup and adds explicit capture in the three generic `except Exception` blocks. Guardrail trips stay out of Sentry.

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_coach.py` (add capture tests) OR Create `backend/tests/test_error_capture.py`

**Interfaces:**
- Consumes: `init_sentry`, `capture_exception` from `sentry_setup` (Task 1).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_error_capture.py`:

```python
from unittest.mock import MagicMock, patch

from utils import OutputGuardrailError

SAMPLE_REFRAME_BODY = {
    "entry_text": "I just helped a bit with the migration",
    "prompt": "What did you ship?",
    "tags": ["technical"],
    "conversation": [],
}


class TestErrorCapture:
    def test_captures_on_unexpected_failure(
        self, mock_client, http_client, authed_user
    ):
        with patch("main.capture_exception") as mock_cap, patch(
            "main.coach_reframe", side_effect=RuntimeError("anthropic down")
        ):
            response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)
        assert response.status_code == 500
        mock_cap.assert_called_once()

    def test_does_not_capture_on_guardrail_trip(
        self, mock_client, http_client, authed_user
    ):
        with patch("main.capture_exception") as mock_cap, patch(
            "main.coach_reframe", side_effect=OutputGuardrailError()
        ):
            response = http_client.post("/coach/reframe", json=SAMPLE_REFRAME_BODY)
        assert response.status_code == 200
        mock_cap.assert_not_called()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_error_capture.py -v`
Expected: FAIL — `main.capture_exception` does not exist (AttributeError on patch).

- [ ] **Step 3: Wire init at startup**

In `backend/main.py`, add to the imports near the other local imports:

```python
from sentry_setup import init_sentry, capture_exception
```

Directly after the existing `configure_logging()` call, add:

```python
init_sentry()
```

- [ ] **Step 4: Add capture to the three generic except blocks**

In `backend/main.py`, in EACH of the three routes (`brag_doc_route`, `coach_turn_route`, `coach_reframe_route`), the final `except Exception:` block currently reads e.g.:

```python
    except Exception:
        logger.exception("coach reframe call failed")
        return JSONResponse(status_code=500, content={"error": "Coach reframe failed"})
```

Add a capture call as the first line inside each generic `except Exception:` block, capturing the current exception. Use `sys.exc_info()[1]` so no variable name change is needed; add `import sys` at the top of the file if not present:

```python
    except Exception:
        capture_exception(sys.exc_info()[1])
        logger.exception("coach reframe call failed")
        return JSONResponse(status_code=500, content={"error": "Coach reframe failed"})
```

Apply the same one-line addition to the `brag_doc_route` and `coach_turn_route` generic `except Exception:` blocks (keep each block's existing `logger.exception` message and return value unchanged). Do NOT add capture to any `except OutputGuardrailError:` block.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_error_capture.py -v`
Expected: PASS (both tests)

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && uv run pytest -q`
Expected: all tests pass (no regressions in existing route tests).

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/tests/test_error_capture.py
git commit -m "feat(backend): capture unexpected route failures in Sentry"
```

---

### Task 3: Frontend Sentry SDK install + instrumentation (prod-gated)

Installs `@sentry/nextjs` and adds the instrumentation files, `global-error.tsx`, and `withSentryConfig` for source maps. Init is gated on production + DSN.

**Files:**
- Modify: `frontend/package.json` (dependency)
- Create: `frontend/sentry.config.ts` (shared init options + the prod/DSN gate)
- Create: `frontend/instrumentation.ts`
- Create: `frontend/instrumentation-client.ts`
- Create: `frontend/src/app/global-error.tsx`
- Modify: `frontend/next.config.ts`
- Create: `frontend/src/app/global-error.test.tsx`

**Interfaces:**
- Produces: `sentryEnabled(): boolean` and `sentryInitOptions()` from `frontend/sentry.config.ts`, consumed by the instrumentation files.

- [ ] **Step 1: Install the dependency**

Run: `cd frontend && npm install @sentry/nextjs`

- [ ] **Step 2: Write the failing test**

Create `frontend/src/app/global-error.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("renders a fallback message", () => {
    render(<GlobalError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm run test -- global-error`
Expected: FAIL — cannot resolve `./global-error`.

- [ ] **Step 4: Create the shared config gate**

Create `frontend/sentry.config.ts`:

```ts
import type { ErrorEvent } from "@sentry/nextjs";

// Production only. Init is skipped unless running in Vercel production with a DSN.
export function sentryEnabled(): boolean {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return env === "production" && Boolean(dsn);
}

export function sentryInitOptions() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: "production",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event: ErrorEvent): ErrorEvent {
      delete event.request;
      return event;
    },
  };
}
```

- [ ] **Step 5: Create the instrumentation files**

Create `frontend/instrumentation.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

import { sentryEnabled, sentryInitOptions } from "./sentry.config";

export async function register() {
  if (sentryEnabled()) {
    Sentry.init(sentryInitOptions());
  }
}

export const onRequestError = Sentry.captureRequestError;
```

Create `frontend/instrumentation-client.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

import { sentryEnabled, sentryInitOptions } from "./sentry.config";

if (sentryEnabled()) {
  Sentry.init(sentryInitOptions());
}
```

- [ ] **Step 6: Create global-error.tsx**

Create `frontend/src/app/global-error.tsx`:

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <p>Something went wrong. Please refresh and try again.</p>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Wrap next.config.ts**

Replace the contents of `frontend/next.config.ts` with:

```ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npm run test -- global-error`
Expected: PASS

- [ ] **Step 9: Verify build, lint, and types**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: no errors. (Source-map upload no-ops locally because `SENTRY_AUTH_TOKEN` is unset.)

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/sentry.config.ts frontend/instrumentation.ts frontend/instrumentation-client.ts frontend/src/app/global-error.tsx frontend/src/app/global-error.test.tsx frontend/next.config.ts
git commit -m "feat(frontend): add Sentry instrumentation and source-map upload"
```

---

### Task 4: Frontend — capture at proxy-route failures

Adds explicit capture at the two existing catch blocks in `createProxyRoute.ts`.

**Files:**
- Modify: `frontend/src/lib/createProxyRoute.ts`
- Create: `frontend/src/lib/createProxyRoute.test.ts`

**Interfaces:**
- Consumes: `@sentry/nextjs` `captureException`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/createProxyRoute.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { captureException } from "@sentry/nextjs";

import { createProxyRoute } from "./createProxyRoute";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  vi.stubEnv("PYTHON_SERVICE_URL", "http://test-python:8000");
  vi.mocked(getSupabaseServerClient).mockResolvedValue({
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { access_token: "t" } } }),
    },
  } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("createProxyRoute error capture", () => {
  it("captures when the upstream fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    const POST = createProxyRoute("/coach/reframe", "Reframe failed");

    const res = await POST(
      new Request("http://localhost/api/coach/reframe", {
        method: "POST",
        body: "{}",
      })
    );

    expect(res.status).toBe(502);
    expect(captureException).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- createProxyRoute`
Expected: FAIL — `captureException` was not called (0 times).

- [ ] **Step 3: Add capture to both catch blocks**

In `frontend/src/lib/createProxyRoute.ts`, add the import at the top:

```ts
import { captureException } from "@sentry/nextjs";
```

In the inner catch block (the one that logs `proxy failed to reach Python service` and returns 502), add as the first line:

```ts
        captureException(error);
```

In the outer catch block (the one that logs `proxy handler failed` and returns 500), add as the first line:

```ts
      captureException(error);
```

(Keep both existing `console.error` lines and both return statements unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- createProxyRoute`
Expected: PASS

- [ ] **Step 5: Run full frontend checks**

Run: `cd frontend && npm run test && npm run lint && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/createProxyRoute.ts frontend/src/lib/createProxyRoute.test.ts
git commit -m "feat(frontend): capture proxy-route failures in Sentry"
```

---

### Task 5: Document secrets and update backlog

Records the manual Sentry setup in the deploy runbook and ticks the backlog item.

**Files:**
- Modify: `DEPLOY.md`
- Modify: `backlog.txt`

- [ ] **Step 1: Add a Sentry section to DEPLOY.md**

Under the "Secrets" area of `DEPLOY.md`, add a subsection documenting the manual setup:

```markdown
### Sentry error tracking (production only)

Two Sentry projects: `byline-frontend` (Next.js) and `byline-backend` (Python).
Sentry is initialized only in production — staging, PR previews, and local dev
send nothing.

Backend (Fly `byline-api` only — do NOT set on staging/PR apps):

    fly secrets set SENTRY_DSN='<backend-dsn>' --app byline-api

Frontend (Vercel — set only on the Production environment, not Preview):

- `NEXT_PUBLIC_SENTRY_DSN` — frontend DSN
- `SENTRY_AUTH_TOKEN` — org auth token, for build-time source-map upload
- `SENTRY_ORG`, `SENTRY_PROJECT` — source-map upload target (project `byline-frontend`)

Strict scrubbing: no journal content or user email reaches Sentry; only `user_id`.
```

- [ ] **Step 2: Tick the backlog item**

In `backlog.txt`, under "Production foundations", remove the `Error tracking — Sentry on frontend and backend.` line from "To Do" (the section is now empty / the item is done).

- [ ] **Step 3: Commit**

```bash
git add DEPLOY.md backlog.txt
git commit -m "docs: document Sentry setup and close error-tracking backlog item"
```

---

## Notes for the implementer

- `@sentry/nextjs` for Next.js 16 uses `instrumentation.ts` (server/edge) + `instrumentation-client.ts` (browser) + `global-error.tsx`. There is no `sentry.client.config.ts`/`sentry.server.config.ts` in this layout — do not create those.
- The backend SDK is a global singleton; `capture_exception` is safe to call even when `init_sentry()` was a no-op (the SDK simply drops the event). That is why prod-gating lives entirely in `init_sentry()` / `sentryEnabled()`.
- Do not add tracing, profiling, or replay integrations. `tracesSampleRate: 0` and the absence of replay keep this errors-only.
