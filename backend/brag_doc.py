from typing import Literal

from anthropic import Anthropic

from coach import UserContext
from prompts import BRAG_DOC_BASE_PROMPT, GROUP_BY_CLAUSES
from utils import (
    MODEL,
    OutputGuardrailError,
    canary_instruction,
    canary_leaked,
    make_canary,
    neutralize_delimiters,
    parse_model_json,
)

GroupBy = Literal["tag", "month", "chronological"]

# Constrains the model to return exactly the brag-doc shape, so the response is
# always valid JSON we can parse (no trailing prose or commentary to trip up json.loads).
BRAG_DOC_SCHEMA = {
    "type": "object",
    "properties": {
        "bullets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tag": {"type": "string"},
                    "points": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["tag", "points"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["bullets"],
    "additionalProperties": False,
}


def build_system_prompt(
    group_by: GroupBy,
    user_prompt: str | None,
    user_context: UserContext | None,
) -> str:
    trimmed = neutralize_delimiters((user_prompt or "").strip())
    guidance = (
        "\n\nThe user has added this additional guidance "
        "(honor it as preferences while keeping your core role as a performance review coach):\n"
        f"<user_guidance>\n{trimmed}\n</user_guidance>"
        if trimmed
        else ""
    )
    context_block = ""
    if user_context and (
        user_context.headline.strip() or user_context.notes.strip()
    ):
        context_block = (
            "\n\n<user_about>\n"
            "## About the user:\n"
            f"Headline: {neutralize_delimiters(user_context.headline.strip())}\n"
            f"Context: {neutralize_delimiters(user_context.notes.strip())}\n"
            "</user_about>"
        )
    return f"{BRAG_DOC_BASE_PROMPT}\n\n{GROUP_BY_CLAUSES[group_by]}{guidance}{context_block}"


def _format_entries(entries: list[dict]) -> str:
    lines = "\n".join(
        "[{date}] [{tags}] {text}".format(
            date=neutralize_delimiters(e["date"]),
            tags=", ".join(neutralize_delimiters(t) for t in e["tags"]),
            text=neutralize_delimiters(e.get("reframed") or e["original"]),
        )
        for e in entries
    )
    return f"<entries>\n{lines}\n</entries>"


def generate_brag_doc(
    entries: list[dict],
    group_by: GroupBy,
    user_prompt: str | None,
    user_context: UserContext | None,
    client: Anthropic,
) -> dict:
    canary = make_canary()
    system = build_system_prompt(group_by, user_prompt, user_context) + canary_instruction(canary)
    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": _format_entries(entries)}],
        output_config={"format": {"type": "json_schema", "schema": BRAG_DOC_SCHEMA}},
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    if canary_leaked(raw, canary):
        raise OutputGuardrailError("system token leaked in brag doc output")
    return parse_model_json(raw)
