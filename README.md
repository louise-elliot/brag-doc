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
