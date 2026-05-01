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
