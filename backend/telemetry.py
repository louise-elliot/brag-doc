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
