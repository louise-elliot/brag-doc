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
