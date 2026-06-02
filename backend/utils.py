import json
import logging
import os
import re

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

logger = logging.getLogger(__name__)


def strip_code_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, count=1)
    text = re.sub(r"\n?```\s*$", "", text, count=1)
    return text


def parse_model_json(raw: str) -> dict:
    try:
        return json.loads(strip_code_fences(raw))
    except json.JSONDecodeError:
        logger.error("Model returned non-JSON response: %r", raw)
        raise
