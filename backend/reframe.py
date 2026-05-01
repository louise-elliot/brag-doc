from anthropic import Anthropic

from prompts import REFRAME_SYSTEM_PROMPT

MODEL = "claude-haiku-4-5-20251001"


def reframe(text: str, client: Anthropic) -> str:
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=REFRAME_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    block = message.content[0]
    return block.text if block.type == "text" else ""
