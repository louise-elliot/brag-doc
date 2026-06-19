# Error Tracking with Sentry — Design

**Date:** 2026-06-17
**Status:** Approved
**Backlog item:** Production foundations — "Error tracking — Sentry on frontend and backend."

## Goal

Aggregate and surface unexpected runtime errors from the Byline frontend (Next.js
on Vercel) and backend (FastAPI on Fly.io) in Sentry, so failures are visible
before users report them. Structured JSON logging already exists on the backend
(`telemetry.py`); this adds error aggregation and alerting on top, not a
replacement for logging.

## Decisions

- **Errors only.** No performance tracing, no session replay (replay records the
  DOM, which is journal content).
- **Production only.** Sentry initializes only in production. Staging, PR previews,
  and local dev do not send events.
- **Strict privacy.** No journal content (entry text, reframed text, coach
  conversation, prompts, notes) ever reaches Sentry. No user email — only `user_id`.
- **Source maps uploaded** for the frontend so production stack traces are readable.

## Prerequisite (manual)

Create two Sentry projects and obtain their credentials:

- `byline-frontend` — platform Next.js → DSN
- `byline-backend` — platform Python/FastAPI → DSN
- An org-level auth token for source-map upload (`SENTRY_AUTH_TOKEN`)

No DSN, token, org, or project slug is hardcoded; all come from environment/secrets.

## Backend (`byline-api`, FastAPI on Fly)

Add `sentry-sdk[fastapi]` to `backend/pyproject.toml`.

Initialize in `main.py`, **only when `SENTRY_DSN` is set** (staging/PR/local apps
won't have the secret, so they stay silent automatically):

```python
sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    environment="production",
    send_default_pii=False,
    include_local_variables=False,   # no entry text via stack-frame locals
    max_request_body_size="never",   # never capture request bodies
    before_send=scrub_event,
)
```

`scrub_event(event, hint)`:
- Removes the `request` block entirely.
- Reduces `user` to `{"id": <user_id>}` only — drops email and any other fields.

**Capture points.** The three LLM routes (`/generate-brag-doc`, `/coach/turn`,
`/coach/reframe`) already wrap their model calls in `try/except`. We add an
explicit `sentry_sdk.capture_exception()` inside each existing generic
`except Exception` block. We do **not** remove the existing try/except or change
the JSON error responses.

`OutputGuardrailError` branches are expected product behavior (they return a
graceful fallback and log a warning). They are **not** sent to Sentry, to avoid
noise. Budget and rate-limit rejections are likewise normal flow, not errors.

**Correlation.** Tag each Sentry event with the existing per-request `request_id`
(already produced by `RequestContextMiddleware` and returned as `X-Request-ID`),
so a Sentry issue can be matched to the JSON logs.

## Frontend (Next.js 16 on Vercel)

Add `@sentry/nextjs`.

Instrumentation files following the Next.js SDK conventions:
- `instrumentation.ts` — server + edge init via `register()`, plus `onRequestError`
  to capture server-side render/route errors.
- `instrumentation-client.ts` — browser init.
- `src/app/global-error.tsx` — captures React render crashes and renders a minimal
  fallback.

Init is gated on `VERCEL_ENV === "production"` (and `NEXT_PUBLIC_VERCEL_ENV` for the
client) **and** a DSN being present, so previews and local dev send nothing.

Strict privacy on init:
- `sendDefaultPii: false`
- `beforeSend` drops request data.
- No `replayIntegration`.

**Capture points.** `createProxyRoute.ts` already `console.error`s in two catch
blocks (502 "couldn't reach Python service" and 500 "proxy handler failed"). Add
`Sentry.captureException(error)` alongside the existing logging at both points.

**Source maps.** Wrap `next.config.ts` with `withSentryConfig`, configured with
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and
`sourcemaps.deleteSourcemapsAfterUpload: true` (so maps are not publicly served).
Upload no-ops when the auth token is absent (local/CI builds without the secret).

## Secrets / environment

| Where | Variable | Purpose |
|-------|----------|---------|
| Fly `byline-api` (prod only) | `SENTRY_DSN` | Backend DSN; presence also gates init |
| Fly `byline-api` (prod only) | `SENTRY_ENVIRONMENT=production` | Explicit environment tag (optional; defaults to "production") |
| Vercel (Production env only) | `NEXT_PUBLIC_SENTRY_DSN` | Frontend DSN |
| Vercel (Production build) | `SENTRY_AUTH_TOKEN` | Source-map upload |
| Vercel (Production build) | `SENTRY_ORG`, `SENTRY_PROJECT` | Source-map upload target |

Staging/PR Fly apps and Vercel preview env deliberately get **no** Sentry secrets.

## Testing (TDD, per coding standards)

Backend (pytest):
- `capture_exception` fires on a genuine `except Exception` failure in each route.
- `capture_exception` does **not** fire on an `OutputGuardrailError` trip.
- `scrub_event` removes the `request` block and reduces `user` to id-only.

Frontend (vitest):
- Both `createProxyRoute` catch paths call `Sentry.captureException`.
- `global-error.tsx` renders its fallback.
- SDK init config is not unit-tested (it is configuration, not logic).

Definition of done: vitest, `npm run lint`, tsc, and pytest all green.

## Out of scope (future backlog)

Alerting rules / Slack/email notifications (dashboard config), performance tracing,
session replay, and staging/preview coverage.
