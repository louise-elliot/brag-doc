# Python LLM Service Refactor — Design

**Date:** 2026-04-28
**Backlog item:** #6 (Refactor AI code into Python)

## Goal

Move the LLM-calling code from the Next.js API routes into a separate Python service. The public API contract (what the browser sees) does not change. The Next.js routes become thin proxies that forward to Python.

## Motivation

1. Working in Python for the AI layer matches preference and the strengths of the Python AI ecosystem.
2. Future AI work in the backlog (multi-turn coaching, pattern learning, guardrails) leans on Python tooling.
3. Setting up an explicit Next.js proxy now leaves a natural home for production concerns later (auth, rate limiting, request logging).

## Architecture

```
Browser  →  Next.js (port 3000)  →  Python service (port 8000)  →  Claude
```

- **Next.js** keeps the UI, localStorage, tabs, and the two API route paths (`/api/reframe`, `/api/generate-brag-doc`). Routes become 10–15 line proxies that forward the request body to Python and pass the response back.
- **Python service** is a new FastAPI app in `backend/` at the repo root. It owns the Anthropic SDK, the system prompts, and JSON-parsing logic for the brag doc.
- **API key** lives in `backend/.env`, no longer in `frontend/.env.local`.
- **Frontend code does not change.** Calls to `/api/reframe` and `/api/generate-brag-doc` work the same way.

## Project structure

```
backend/
  pyproject.toml
  .python-version          # 3.12
  .env.example
  .env                     # gitignored
  README.md
  main.py                  # FastAPI app + route declarations
  prompts.py               # system prompts as constants
  reframe.py               # reframe handler logic
  brag_doc.py              # brag doc handler logic + JSON parse
  tests/
    test_reframe.py
    test_brag_doc.py
```

Flat layout, no `src/`. Two small handler modules so each file has one job. `prompts.py` mirrors the existing `frontend/src/lib/prompts.ts` pattern.

## Tech choices

| Concern | Choice | Why |
|---|---|---|
| Web framework | FastAPI | Modern Python standard; async; Pydantic validation; OpenAPI docs free |
| Dependency manager | uv | Fast, single binary; modern equivalent of pip/poetry |
| Validation | Pydantic | Built into FastAPI; declarative request/response models |
| Anthropic | `anthropic` Python SDK | Official; mirrors the TypeScript SDK |
| Tests | pytest + FastAPI TestClient | Idiomatic; mock Anthropic at boundary |
| Env | python-dotenv | Loads `backend/.env` in dev |
| Python version | 3.12, pinned via `.python-version` | Modern, well-supported |

No additional dependencies. Things like `slowapi` (rate limiting), `structlog` (logging), or `httpx` get added when there is a reason.

## API contract (unchanged)

### POST /reframe

Request: `{ "text": string }`
Response: `{ "reframed": string }`

### POST /generate-brag-doc

Request: `{ "entries": Entry[], "groupBy"?: "tag" | "month" | "chronological", "userPrompt"?: string }`
Response: `{ "bullets": [{ "tag": string, "points": string[] }] }`

Validation moves entirely to Python (Pydantic). Next.js does not validate request bodies — one source of truth.

## Next.js proxy shape

```typescript
// frontend/src/app/api/reframe/route.ts
import { NextResponse } from "next/server";

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${PYTHON_URL}/reframe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

The `/api/generate-brag-doc` route follows the same shape with a different upstream path.

`PYTHON_SERVICE_URL` is added to `frontend/.env.local` (default `http://localhost:8000`). In production it points at wherever Python is hosted.

## Dev workflow

Two terminals:

```
# terminal 1
cd backend && uv run fastapi dev    # serves on localhost:8000

# terminal 2
cd frontend && npm run dev           # serves on localhost:3000
```

Documented in the root `README.md`.

## Testing strategy

| Layer | Test target | Approach |
|---|---|---|
| Python | Handler logic, prompt construction, JSON parsing | pytest; mock Anthropic client; FastAPI TestClient for endpoint shape |
| Next.js routes | Proxy forwards correctly | vitest; mock `fetch`; assert URL, method, body, response passthrough |
| Existing component/lib tests | Unchanged | Still green |
| Playwright E2E | Full flows | Both services must be running |

The Anthropic SDK is mocked in one place only (Python). Next.js tests do not need to know Claude exists.

## Rollout order

1. Scaffold `backend/` with uv, FastAPI, pytest. Stub endpoints return `{"ok": true}`.
2. Port `/reframe`: Pydantic model, prompt constant, Anthropic call, mocked-client tests.
3. Port `/generate-brag-doc`: same pattern plus JSON parsing and `groupBy` handling.
4. Rewrite the two Next.js routes as proxies. Update their tests to mock `fetch`.
5. Move `ANTHROPIC_API_KEY` from `frontend/.env.local` to `backend/.env`. Add `PYTHON_SERVICE_URL` to `frontend/.env.local`.
6. Update root `README.md` with the two-terminal dev workflow.
7. Run full test suite + Playwright with both services up. Manual smoke test.

## Out of scope

Tracked separately on `backlog.txt`:

- Auth and rate limiting
- Request logging, observability, cost tracking
- Hosting and deployment configuration
- Streaming responses
- Any new AI features (multi-turn coaching, guardrails, etc.)

This refactor is a behaviour-preserving port. Same inputs, same outputs, different runtime.
