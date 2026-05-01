# Python LLM Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move LLM calls from the Next.js API routes into a FastAPI Python service. The Next.js routes become thin proxies; public API contract is unchanged.

**Architecture:** Two services on the developer's machine — Next.js (port 3000) serves the UI, Python FastAPI (port 8000) owns the Anthropic SDK and prompts. The two existing API route paths (`/api/reframe`, `/api/generate-brag-doc`) are rewritten as 10–15 line proxies that forward request bodies to Python and pass responses back. Behaviour-preserving port.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, Anthropic Python SDK, uv, pytest, python-dotenv. Frontend stays on Next.js 16 / vitest.

**Spec:** `docs/superpowers/specs/python-refactoring-design.md`

**Note on commits:** the repo owner handles git commits manually. Each task ends with a `git add` step plus a suggested commit message. Stop before running `git commit` and let the user commit.

---

## File Structure

**New files (Python service):**

| File | Responsibility |
|---|---|
| `backend/pyproject.toml` | uv project file with dependencies |
| `backend/.python-version` | `3.12` |
| `backend/.env.example` | `ANTHROPIC_API_KEY=` template |
| `backend/.gitignore` | ignore `.env`, `.venv`, `__pycache__`, `.pytest_cache` |
| `backend/README.md` | install + run instructions |
| `backend/main.py` | FastAPI app, route handlers, Pydantic models, Anthropic client dependency |
| `backend/prompts.py` | system prompts as constants |
| `backend/reframe.py` | pure function `reframe(text, client) -> str` |
| `backend/brag_doc.py` | pure function `generate_brag_doc(entries, group_by, user_prompt, client) -> dict` + JSON parse |
| `backend/tests/__init__.py` | empty (marks `tests` as package) |
| `backend/tests/conftest.py` | pytest fixtures (mock Anthropic client, FastAPI TestClient) |
| `backend/tests/test_health.py` | health check endpoint test |
| `backend/tests/test_reframe.py` | unit + endpoint tests |
| `backend/tests/test_brag_doc.py` | unit + endpoint tests |

**New file (root):**

| File | Responsibility |
|---|---|
| `README.md` | root-level dev workflow doc (two terminals) |

**Modified files (Next.js):**

| File | Change |
|---|---|
| `frontend/src/app/api/reframe/route.ts` | rewrite as proxy |
| `frontend/src/app/api/reframe/route.test.ts` | rewrite tests to mock `fetch` |
| `frontend/src/app/api/generate-brag-doc/route.ts` | rewrite as proxy |
| `frontend/src/app/api/generate-brag-doc/route.test.ts` | rewrite tests to mock `fetch` |
| `frontend/.env.example` | replace `ANTHROPIC_API_KEY=` with `PYTHON_SERVICE_URL=http://localhost:8000` |
| `frontend/package.json` | remove `@anthropic-ai/sdk` dependency |

**User-managed (not edited by automation):**
- `frontend/.env.local` — user moves `ANTHROPIC_API_KEY` to `backend/.env`, adds `PYTHON_SERVICE_URL=http://localhost:8000` to `frontend/.env.local`.

---

## Task 1: Scaffold backend project with health check

**Files:**
- Create: `backend/pyproject.toml`, `backend/.python-version`, `backend/.env.example`, `backend/.gitignore`, `backend/README.md`, `backend/main.py`, `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_health.py`

- [ ] **Step 1: Initialize uv project**

From the repo root:

```bash
uv init backend --python 3.12
```

Expected: creates `backend/pyproject.toml`, `backend/.python-version`, `backend/main.py` (placeholder), `backend/README.md` (placeholder), `backend/.gitignore`, and a `backend/.git` is NOT created (we use the existing repo's git).

If the command creates an unwanted `backend/.git/`, remove it: `rm -rf backend/.git`.

- [ ] **Step 2: Add runtime dependencies**

```bash
cd backend && uv add 'fastapi[standard]' anthropic python-dotenv
```

Expected: `pyproject.toml` lists `fastapi[standard]`, `anthropic`, `python-dotenv` under `[project] dependencies`. A `uv.lock` file is created. A `.venv` directory is created.

- [ ] **Step 3: Add dev dependencies**

```bash
uv add --dev pytest
```

Expected: `pyproject.toml` adds a `[dependency-groups] dev` section with `pytest`.

- [ ] **Step 4: Configure pytest**

Append the following to `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

This lets tests import top-level modules (`main`, `reframe`, etc.) without a `src/` layout.

- [ ] **Step 5: Replace `backend/.gitignore`**

Replace contents of `backend/.gitignore` with:

```
.venv/
__pycache__/
.pytest_cache/
.env
*.pyc
```

- [ ] **Step 6: Create `backend/.env.example`**

```
ANTHROPIC_API_KEY=
```

- [ ] **Step 7: Replace `backend/README.md`**

```markdown
# Backend

Python service that owns LLM calls (reframe, brag doc generation).

## Setup

```
uv sync
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Run

```
uv run fastapi dev
```

Serves on `http://localhost:8000`. OpenAPI docs at `/docs`.

## Test

```
uv run pytest
```
```

- [ ] **Step 8: Create test scaffolding**

Create `backend/tests/__init__.py` as an empty file.

Create `backend/tests/conftest.py`:

```python
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app, get_anthropic_client


@pytest.fixture
def mock_client():
    """Replace the Anthropic dependency with a MagicMock for the duration of the test."""
    client = MagicMock()
    app.dependency_overrides[get_anthropic_client] = lambda: client
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def http_client():
    return TestClient(app)
```

- [ ] **Step 9: Write the failing health-check test**

Create `backend/tests/test_health.py`:

```python
def test_health_returns_ok(http_client):
    response = http_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 10: Run the test to verify it fails**

```bash
uv run pytest tests/test_health.py -v
```

Expected: FAIL — `main.py` does not yet define `app`, `get_anthropic_client`, or `/health`. Likely an `ImportError` from `conftest.py`.

- [ ] **Step 11: Replace `backend/main.py` with the FastAPI scaffold**

```python
from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

app = FastAPI(title="Confidence Journal Backend")


def get_anthropic_client() -> Anthropic:
    return Anthropic()


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 12: Run the test to verify it passes**

```bash
uv run pytest tests/test_health.py -v
```

Expected: PASS (1 passed).

- [ ] **Step 13: Stage for commit**

```bash
git add backend/
```

Suggested commit message: `feat(backend): scaffold FastAPI service with health check`.

---

## Task 2: Port `/reframe` endpoint with TDD

**Files:**
- Create: `backend/prompts.py`, `backend/reframe.py`, `backend/tests/test_reframe.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing reframe tests**

Create `backend/tests/test_reframe.py`:

```python
from unittest.mock import MagicMock

import pytest


def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)]
    )


class TestReframeEndpoint:
    def test_returns_reframed_text(self, mock_client, http_client):
        _mock_text_response(mock_client, "I resolved a critical production issue")

        response = http_client.post(
            "/reframe", json={"text": "I just helped fix a bug"}
        )

        assert response.status_code == 200
        assert response.json() == {"reframed": "I resolved a critical production issue"}

    def test_returns_422_when_text_missing(self, mock_client, http_client):
        response = http_client.post("/reframe", json={})
        assert response.status_code == 422

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception(
            "UPSTREAM_SECRET_KEY_XYZ leaked"
        )

        response = http_client.post("/reframe", json={"text": "hello"})

        assert response.status_code == 500
        body = response.json()
        assert body == {"error": "Reframe failed"}
        assert "UPSTREAM_SECRET_KEY_XYZ" not in response.text

    def test_calls_anthropic_with_reframe_system_prompt(
        self, mock_client, http_client
    ):
        _mock_text_response(mock_client, "out")
        http_client.post("/reframe", json={"text": "in"})

        kwargs = mock_client.messages.create.call_args.kwargs
        assert "confidence coach for women in tech" in kwargs["system"]
        assert kwargs["model"] == "claude-haiku-4-5-20251001"
        assert kwargs["messages"] == [{"role": "user", "content": "in"}]
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest tests/test_reframe.py -v
```

Expected: 4 tests fail. The endpoint does not exist yet.

- [ ] **Step 3: Create `backend/prompts.py`**

```python
REFRAME_SYSTEM_PROMPT = (
    "You are a confidence coach for women in tech. Reframe the following "
    "accomplishment to be more direct, impactful, and free of self-diminishing "
    "language. Preserve the facts but remove hedging, luck-attribution, and "
    "team-deflection. Keep approximately the same length. Return only the "
    "reframed text, no commentary."
)
```

- [ ] **Step 4: Create `backend/reframe.py`**

```python
from anthropic import Anthropic

from prompts import REFRAME_SYSTEM_PROMPT

MODEL = "claude-haiku-4-5-20251001"


def reframe(text: str, client: Anthropic) -> str:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=REFRAME_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    block = message.content[0]
    return block.text if block.type == "text" else ""
```

- [ ] **Step 5: Wire the endpoint into `backend/main.py`**

Replace `backend/main.py` with:

```python
import logging

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from reframe import reframe

load_dotenv()

logger = logging.getLogger("backend")

app = FastAPI(title="Confidence Journal Backend")


def get_anthropic_client() -> Anthropic:
    return Anthropic()


class ReframeRequest(BaseModel):
    text: str


class ReframeResponse(BaseModel):
    reframed: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/reframe", response_model=ReframeResponse)
def reframe_route(
    body: ReframeRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        reframed = reframe(body.text, client)
    except Exception:
        logger.exception("reframe call failed")
        return JSONResponse(status_code=500, content={"error": "Reframe failed"})
    return ReframeResponse(reframed=reframed)
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
uv run pytest tests/test_reframe.py -v
```

Expected: 4 passed.

- [ ] **Step 7: Run the full backend test suite**

```bash
uv run pytest -v
```

Expected: 5 passed (1 health + 4 reframe).

- [ ] **Step 8: Stage for commit**

```bash
git add backend/
```

Suggested commit message: `feat(backend): port /reframe endpoint to FastAPI`.

---

## Task 3: Port `/generate-brag-doc` endpoint with TDD

**Files:**
- Create: `backend/brag_doc.py`, `backend/tests/test_brag_doc.py`
- Modify: `backend/prompts.py`, `backend/main.py`

- [ ] **Step 1: Write the failing brag-doc tests**

Create `backend/tests/test_brag_doc.py`:

```python
import json
from unittest.mock import MagicMock


def _mock_text_response(client: MagicMock, text: str) -> None:
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(type="text", text=text)]
    )


SAMPLE_ENTRY = {
    "id": "1",
    "date": "2026-04-01",
    "prompt": "What impact?",
    "original": "Led the review",
    "reframed": None,
    "tags": ["leadership"],
    "createdAt": "2026-04-01T18:00:00Z",
}


def _post(http_client, body):
    return http_client.post("/generate-brag-doc", json=body)


class TestBragDocEndpoint:
    def test_returns_grouped_bullet_points(self, mock_client, http_client):
        _mock_text_response(
            mock_client,
            json.dumps(
                {
                    "bullets": [
                        {
                            "tag": "leadership",
                            "points": ["Drove architectural decisions across the team"],
                        }
                    ]
                }
            ),
        )

        response = _post(http_client, {"entries": [SAMPLE_ENTRY]})

        assert response.status_code == 200
        data = response.json()
        assert len(data["bullets"]) == 1
        assert data["bullets"][0]["tag"] == "leadership"
        assert (
            "Drove architectural decisions across the team"
            in data["bullets"][0]["points"]
        )

    def test_returns_422_when_entries_missing(self, mock_client, http_client):
        response = _post(http_client, {})
        assert response.status_code == 422

    def test_defaults_to_tag_grouping(self, mock_client, http_client):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": []})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "Group bullets by tag category" in system

    def test_uses_month_grouping_when_groupBy_is_month(self, mock_client, http_client):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": [], "groupBy": "month"})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "Group bullets by calendar month" in system
        assert "Month YYYY" in system

    def test_uses_chronological_when_groupBy_is_chronological(
        self, mock_client, http_client
    ):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": [], "groupBy": "chronological"})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "single group" in system
        assert "empty string" in system

    def test_appends_userPrompt_guidance_when_provided(self, mock_client, http_client):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(
            http_client,
            {
                "entries": [],
                "userPrompt": "emphasize cross-functional collaboration",
            },
        )

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "emphasize cross-functional collaboration" in system
        assert "additional guidance" in system

    def test_does_not_append_guidance_when_userPrompt_is_whitespace(
        self, mock_client, http_client
    ):
        _mock_text_response(mock_client, '{"bullets": []}')
        _post(http_client, {"entries": [], "userPrompt": "   "})

        system = mock_client.messages.create.call_args.kwargs["system"]
        assert "additional guidance" not in system

    def test_strips_markdown_code_fences_from_anthropic_response(
        self, mock_client, http_client
    ):
        fenced = '```json\n{"bullets": [{"tag": "x", "points": ["y"]}]}\n```'
        _mock_text_response(mock_client, fenced)

        response = _post(http_client, {"entries": []})

        assert response.status_code == 200
        assert response.json()["bullets"][0]["tag"] == "x"

    def test_returns_500_with_generic_message_when_anthropic_throws(
        self, mock_client, http_client
    ):
        mock_client.messages.create.side_effect = Exception("INTERNAL_KEY_ABC leaked")

        response = _post(http_client, {"entries": []})

        assert response.status_code == 500
        assert response.json() == {"error": "Brag doc generation failed"}
        assert "INTERNAL_KEY_ABC" not in response.text
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest tests/test_brag_doc.py -v
```

Expected: 9 tests fail (endpoint does not exist).

- [ ] **Step 3: Append brag-doc prompts to `backend/prompts.py`**

Append to `backend/prompts.py`:

```python

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

- [ ] **Step 4: Create `backend/brag_doc.py`**

```python
import json
import re
from typing import Literal

from anthropic import Anthropic

from prompts import BRAG_DOC_BASE_PROMPT, GROUP_BY_CLAUSES

MODEL = "claude-haiku-4-5-20251001"

GroupBy = Literal["tag", "month", "chronological"]


def build_system_prompt(group_by: GroupBy, user_prompt: str | None) -> str:
    trimmed = (user_prompt or "").strip()
    guidance = (
        f"\n\nThe user has added this additional guidance: {trimmed}\n\n"
        "Honor it while keeping your core role as a performance review coach."
        if trimmed
        else ""
    )
    return f"{BRAG_DOC_BASE_PROMPT}\n\n{GROUP_BY_CLAUSES[group_by]}{guidance}"


def _format_entries(entries: list[dict]) -> str:
    return "\n".join(
        f"[{e['date']}] [{', '.join(e['tags'])}] {e['original']}" for e in entries
    )


def _strip_code_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, count=1)
    text = re.sub(r"\n?```\s*$", "", text, count=1)
    return text


def generate_brag_doc(
    entries: list[dict],
    group_by: GroupBy,
    user_prompt: str | None,
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=build_system_prompt(group_by, user_prompt),
        messages=[{"role": "user", "content": _format_entries(entries)}],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    return json.loads(_strip_code_fences(raw))
```

- [ ] **Step 5: Wire the brag-doc endpoint into `backend/main.py`**

Replace `backend/main.py` with:

```python
import logging
from typing import Literal, Optional

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from brag_doc import generate_brag_doc
from reframe import reframe

load_dotenv()

logger = logging.getLogger("backend")

app = FastAPI(title="Confidence Journal Backend")


def get_anthropic_client() -> Anthropic:
    return Anthropic()


class ReframeRequest(BaseModel):
    text: str


class ReframeResponse(BaseModel):
    reframed: str


class Entry(BaseModel):
    id: str
    date: str
    prompt: str
    original: str
    reframed: Optional[str] = None
    tags: list[str]
    createdAt: str


class BragDocRequest(BaseModel):
    entries: list[Entry]
    groupBy: Literal["tag", "month", "chronological"] = "tag"
    userPrompt: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/reframe", response_model=ReframeResponse)
def reframe_route(
    body: ReframeRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        reframed = reframe(body.text, client)
    except Exception:
        logger.exception("reframe call failed")
        return JSONResponse(status_code=500, content={"error": "Reframe failed"})
    return ReframeResponse(reframed=reframed)


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
            client=client,
        )
    except Exception:
        logger.exception("brag doc generation failed")
        return JSONResponse(
            status_code=500, content={"error": "Brag doc generation failed"}
        )
    return result
```

- [ ] **Step 6: Run the brag-doc tests to verify they pass**

```bash
uv run pytest tests/test_brag_doc.py -v
```

Expected: 9 passed.

- [ ] **Step 7: Run the full backend test suite**

```bash
uv run pytest -v
```

Expected: 14 passed (1 health + 4 reframe + 9 brag doc).

- [ ] **Step 8: Stage for commit**

```bash
git add backend/
```

Suggested commit message: `feat(backend): port /generate-brag-doc endpoint to FastAPI`.

---

## Task 4: Rewrite Next.js `/api/reframe` as a proxy

**Files:**
- Modify: `frontend/src/app/api/reframe/route.ts`, `frontend/src/app/api/reframe/route.test.ts`

- [ ] **Step 1: Replace `frontend/src/app/api/reframe/route.test.ts` with proxy tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { POST } from "./route";

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  vi.stubEnv("PYTHON_SERVICE_URL", "http://test-python:8000");
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe("POST /api/reframe (proxy)", () => {
  it("forwards the request body to the Python /reframe endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reframed: "polished" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    global.fetch = fetchMock;

    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "raw" }),
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://test-python:8000/reframe");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ text: "raw" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reframed: "polished" });
  });

  it("passes through non-2xx status codes from Python", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Reframe failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = new Request("http://localhost/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "raw" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Reframe failed" });
  });

  it("falls back to localhost:8000 when PYTHON_SERVICE_URL is unset", async () => {
    vi.unstubAllEnvs();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    global.fetch = fetchMock;

    await POST(
      new Request("http://localhost/api/reframe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "raw" }),
      })
    );

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/reframe");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && npm test -- src/app/api/reframe/route.test.ts
```

Expected: tests fail. The current `route.ts` still calls Anthropic directly; mocked `fetch` is never called.

- [ ] **Step 3: Replace `frontend/src/app/api/reframe/route.ts` with the proxy**

The env lookup lives **inside** the handler so each request reads the current value (otherwise tests that stub the env per-case would not affect a top-level constant captured at import time).

```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const pythonUrl =
    process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
  const body = await request.text();
  const upstream = await fetch(`${pythonUrl}/reframe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npm test -- src/app/api/reframe/route.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Stage for commit**

```bash
git add frontend/src/app/api/reframe/
```

Suggested commit message: `refactor(api): rewrite /api/reframe as proxy to Python service`.

---

## Task 5: Rewrite Next.js `/api/generate-brag-doc` as a proxy

**Files:**
- Modify: `frontend/src/app/api/generate-brag-doc/route.ts`, `frontend/src/app/api/generate-brag-doc/route.test.ts`

- [ ] **Step 1: Replace `frontend/src/app/api/generate-brag-doc/route.test.ts` with proxy tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { POST } from "./route";

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  vi.stubEnv("PYTHON_SERVICE_URL", "http://test-python:8000");
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
});

describe("POST /api/generate-brag-doc (proxy)", () => {
  it("forwards the request body to the Python /generate-brag-doc endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          bullets: [{ tag: "leadership", points: ["Did the thing"] }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    global.fetch = fetchMock;

    const requestBody = {
      entries: [
        {
          id: "1",
          date: "2026-04-01",
          prompt: "What impact?",
          original: "Led the review",
          reframed: null,
          tags: ["leadership"],
          createdAt: "2026-04-01T18:00:00Z",
        },
      ],
      groupBy: "month",
      userPrompt: "emphasize collaboration",
    };

    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://test-python:8000/generate-brag-doc");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(requestBody));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bullets[0].tag).toBe("leadership");
  });

  it("passes through non-2xx status codes from Python", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Brag doc generation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = new Request("http://localhost/api/generate-brag-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Brag doc generation failed" });
  });

  it("falls back to localhost:8000 when PYTHON_SERVICE_URL is unset", async () => {
    vi.unstubAllEnvs();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    global.fetch = fetchMock;

    await POST(
      new Request("http://localhost/api/generate-brag-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [] }),
      })
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/generate-brag-doc"
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && npm test -- src/app/api/generate-brag-doc/route.test.ts
```

Expected: tests fail.

- [ ] **Step 3: Replace `frontend/src/app/api/generate-brag-doc/route.ts` with the proxy**

```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const pythonUrl =
    process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
  const body = await request.text();
  const upstream = await fetch(`${pythonUrl}/generate-brag-doc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npm test -- src/app/api/generate-brag-doc/route.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Stage for commit**

```bash
git add frontend/src/app/api/generate-brag-doc/
```

Suggested commit message: `refactor(api): rewrite /api/generate-brag-doc as proxy to Python service`.

---

## Task 6: Update env config, root README, and remove the SDK dep

**Files:**
- Modify: `frontend/.env.example`, `frontend/package.json`
- Create: `README.md` (repo root)

- [ ] **Step 1: Replace `frontend/.env.example`**

```
PYTHON_SERVICE_URL=http://localhost:8000
```

- [ ] **Step 2: Remove the Anthropic SDK from frontend**

```bash
cd frontend && npm uninstall @anthropic-ai/sdk
```

Expected: `@anthropic-ai/sdk` is removed from `package.json` `dependencies` and from `package-lock.json`. `node_modules/@anthropic-ai/` is removed.

- [ ] **Step 3: Verify nothing else imports the removed package**

```bash
cd frontend && grep -r "@anthropic-ai/sdk" src/ e2e/ || echo "no references found"
```

Expected: `no references found`.

- [ ] **Step 4: Run the full frontend test suite**

```bash
cd frontend && npm test
```

Expected: all vitest tests pass (route tests now use mocked `fetch`; component/lib tests unchanged).

- [ ] **Step 5: Create root `README.md`**

```markdown
# Confidence Journal

A daily wins journal for women in tech. Next.js frontend, Python FastAPI service for LLM calls.

## Project layout

- `frontend/` — Next.js app (UI, localStorage, tabs)
- `backend/` — FastAPI service (Anthropic SDK, prompts)
- `docs/` — specs and plans

## Development

Run both services in parallel terminals.

### Terminal 1 — backend

```
cd backend
uv sync
cp .env.example .env  # then add your ANTHROPIC_API_KEY
uv run fastapi dev
```

Serves on `http://localhost:8000`.

### Terminal 2 — frontend

```
cd frontend
npm install
cp .env.example .env.local  # PYTHON_SERVICE_URL is preset
npm run dev
```

Serves on `http://localhost:3000`.

## Tests

- Frontend unit + component: `cd frontend && npm test`
- Frontend E2E (Playwright, requires both services running): `cd frontend && npm run test:e2e`
- Backend: `cd backend && uv run pytest`

## Environment variables

| Where | Var | Purpose |
|---|---|---|
| `backend/.env` | `ANTHROPIC_API_KEY` | Anthropic API key |
| `frontend/.env.local` | `PYTHON_SERVICE_URL` | URL of the backend (defaults to `http://localhost:8000`) |
```

- [ ] **Step 6: Stage for commit**

```bash
git add frontend/.env.example frontend/package.json frontend/package-lock.json README.md
```

Suggested commit message: `chore: drop frontend Anthropic SDK; document two-terminal dev workflow`.

---

## Task 7: Final verification

**Files:** none modified — this task only runs verifications.

- [ ] **Step 1: Make the user manually update `frontend/.env.local` and create `backend/.env`**

The user (not the automation) does this once:

1. Move `ANTHROPIC_API_KEY=...` from `frontend/.env.local` into `backend/.env`.
2. Add `PYTHON_SERVICE_URL=http://localhost:8000` to `frontend/.env.local`.

Confirm with the user before proceeding.

- [ ] **Step 2: Run the backend test suite**

```bash
cd backend && uv run pytest -v
```

Expected: 14 passed.

- [ ] **Step 3: Run the frontend unit test suite**

```bash
cd frontend && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Start both services for manual + E2E checks**

In one terminal:

```bash
cd backend && uv run fastapi dev
```

In another:

```bash
cd frontend && npm run dev
```

Verify:
- `http://localhost:8000/health` returns `{"status":"ok"}`.
- `http://localhost:8000/docs` shows the FastAPI OpenAPI page with `/reframe` and `/generate-brag-doc`.
- `http://localhost:3000` loads the journal UI.

- [ ] **Step 5: Manual smoke test in the browser**

1. Write a short journal entry, tag it, click Save.
2. Confirm the reframe card appears with reframed text.
3. Switch to Brag Doc tab, click Generate, confirm bullets render.
4. Try the month and chronological groupings.
5. Try adding a `userPrompt` and regenerating — confirm guidance is reflected.

- [ ] **Step 6: Run Playwright E2E with both services up**

```bash
cd frontend && npm run test:e2e
```

Expected: all E2E specs pass.

- [ ] **Step 7: Check git status is clean**

```bash
git status
```

Expected: working tree clean (all earlier tasks already staged/committed by the user).

---

## Out of scope (tracked on `backlog.txt`)

- Auth and rate limiting
- Request logging, observability, cost tracking
- Hosting and deployment configuration for the Python service
- Streaming responses
- Any new AI features (multi-turn coaching, guardrails, etc.)
