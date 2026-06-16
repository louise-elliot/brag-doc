"""Structured logging and per-request LLM cost/telemetry capture."""
from __future__ import annotations

import contextvars
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from starlette.middleware.base import BaseHTTPMiddleware

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
