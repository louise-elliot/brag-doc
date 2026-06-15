from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel, Field

from prompts import COACH_REFRAME_SYSTEM_PROMPT, COACH_TURN_SYSTEM_PROMPT, COACH_STYLE_FRAGMENTS
from utils import (
    MODEL,
    OutputGuardrailError,
    canary_instruction,
    canary_leaked,
    make_canary,
    neutralize_delimiters,
    parse_model_json,
)


class Message(BaseModel):
    role: Literal["coach", "user"]
    text: str = Field(max_length=10_000)
    notes: list[str] = Field(default_factory=list, max_length=50)

class UserContext(BaseModel):
    headline: str = Field(max_length=500)
    notes: str = Field(max_length=5_000)


def _format_user_content(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
) -> str:
    safe_tags = [neutralize_delimiters(t) for t in tags]
    header = (
        f"Daily prompt: {neutralize_delimiters(prompt)}\n"
        f"Entry tags: {', '.join(safe_tags) if safe_tags else '(none)'}\n"
        f"Original entry:\n{neutralize_delimiters(entry_text)}"
    )
    if conversation:
        lines = [header, "", "Conversation so far:"]
        for msg in conversation:
            speaker = "Coach" if msg.role == "coach" else "User"
            lines.append(f"{speaker}: {neutralize_delimiters(msg.text)}")
        body = "\n".join(lines)
    else:
        body = header
    return f"<user_content>\n{body}\n</user_content>"

def _format_user_context_block(context: UserContext) -> str:
    return (
        "<user_about>\n"
        "## About the user:\n"
        f"Headline: {neutralize_delimiters(context.headline.strip())}\n"
        f"Context: {neutralize_delimiters(context.notes.strip())}\n"
        "</user_about>"
    )

def build_coach_system_prompt(
    base: str,
    style: str,
    context: UserContext | None,
) -> str:
    parts = [base, COACH_STYLE_FRAGMENTS[style]]
    if context and (context.headline.strip() or context.notes.strip()):
        parts.append(_format_user_context_block(context))
    return "\n\n".join(parts)

def coach_turn(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    coaching_style: str,
    user_context: UserContext | None,
    client: Anthropic,
) -> dict:
    canary = make_canary()
    system = build_coach_system_prompt(
        COACH_TURN_SYSTEM_PROMPT, coaching_style, user_context
    ) + canary_instruction(canary)
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system,
        messages=[
            {
                "role": "user",
                "content": _format_user_content(entry_text, prompt, tags, conversation),
            }
        ],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    if canary_leaked(raw, canary):
        raise OutputGuardrailError("system token leaked in coach turn output")
    return parse_model_json(raw)


def coach_reframe(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    coaching_style: str,
    user_context: UserContext | None,
    client: Anthropic,
) -> dict:
    canary = make_canary()
    system = build_coach_system_prompt(
        COACH_REFRAME_SYSTEM_PROMPT, coaching_style, user_context
    ) + canary_instruction(canary)
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system,
        messages=[
            {
                "role": "user",
                "content": _format_user_content(entry_text, prompt, tags, conversation),
            }
        ],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    if canary_leaked(raw, canary):
        raise OutputGuardrailError("system token leaked in coach reframe output")
    return parse_model_json(raw)
