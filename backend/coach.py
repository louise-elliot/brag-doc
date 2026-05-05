import json
import re
from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel

from prompts import COACH_REFRAME_SYSTEM_PROMPT, COACH_TURN_SYSTEM_PROMPT

MODEL = "claude-haiku-4-5-20251001"


class Message(BaseModel):
    role: Literal["coach", "user"]
    text: str
    notes: list[str] = []


def _strip_code_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, count=1)
    text = re.sub(r"\n?```\s*$", "", text, count=1)
    return text


def _format_user_content(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
) -> str:
    header = (
        f"Daily prompt: {prompt}\n"
        f"Entry tags: {', '.join(tags) if tags else '(none)'}\n"
        f"Original entry:\n{entry_text}"
    )
    if not conversation:
        return header
    lines = [header, "", "Conversation so far:"]
    for msg in conversation:
        speaker = "Coach" if msg.role == "coach" else "User"
        lines.append(f"{speaker}: {msg.text}")
    return "\n".join(lines)


def coach_turn(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=COACH_TURN_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _format_user_content(entry_text, prompt, tags, conversation),
            }
        ],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    return json.loads(_strip_code_fences(raw))


def coach_reframe(
    entry_text: str,
    prompt: str,
    tags: list[str],
    conversation: list[Message],
    client: Anthropic,
) -> dict:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=COACH_REFRAME_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _format_user_content(entry_text, prompt, tags, conversation),
            }
        ],
    )
    block = message.content[0]
    raw = block.text if block.type == "text" else "{}"
    return json.loads(_strip_code_fences(raw))
