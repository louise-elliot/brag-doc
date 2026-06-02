from typing import Literal

from anthropic import Anthropic

from coach import UserContext
from prompts import BRAG_DOC_BASE_PROMPT, GROUP_BY_CLAUSES
from utils import MODEL, parse_model_json

GroupBy = Literal["tag", "month", "chronological"]


def build_system_prompt(
    group_by: GroupBy,
    user_prompt: str | None,
    user_context: UserContext | None,
) -> str:
    trimmed = (user_prompt or "").strip()
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
            f"Headline: {user_context.headline.strip()}\n"
            f"Context: {user_context.notes.strip()}\n"
            "</user_about>"
        )
    return f"{BRAG_DOC_BASE_PROMPT}\n\n{GROUP_BY_CLAUSES[group_by]}{guidance}{context_block}"


def _format_entries(entries: list[dict]) -> str:
    lines = "\n".join(
        f"[{e['date']}] [{', '.join(e['tags'])}] {e.get('reframed') or e['original']}"
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
    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=build_system_prompt(group_by, user_prompt, user_context),
        messages=[{"role": "user", "content": _format_entries(entries)}],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    return parse_model_json(raw)
