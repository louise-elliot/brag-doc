import logging

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from brag_doc import GroupBy, generate_brag_doc
from coach import Message, coach_reframe, coach_turn

load_dotenv()

logger = logging.getLogger("backend")

app = FastAPI(title="Confidence Journal Backend")


def get_anthropic_client() -> Anthropic:
    return Anthropic()


class Entry(BaseModel):
    id: str
    date: str
    prompt: str
    original: str
    reframed: str | None = None
    tags: list[str]
    createdAt: str
    coachNotes: list[str] | None = None


class BragDocRequest(BaseModel):
    entries: list[Entry]
    groupBy: GroupBy = "tag"
    userPrompt: str | None = None


class CoachTurnRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]


class CoachTurnResponse(BaseModel):
    text: str
    notes: list[str]


class CoachReframeRequest(BaseModel):
    entry_text: str
    prompt: str
    tags: list[str]
    conversation: list[Message]


class CoachReframeResponse(BaseModel):
    reframed: str
    notes: list[str]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-brag-doc")
def brag_doc_route(
    body: BragDocRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        result = generate_brag_doc(
            entries=[e.model_dump() for e in body.entries],
            group_by=body.groupBy,
            user_prompt=body.userPrompt,
            client=client,
        )
    except Exception:
        logger.exception("brag doc generation failed")
        return JSONResponse(
            status_code=500, content={"error": "Brag doc generation failed"}
        )
    return result


@app.post("/coach/turn", response_model=CoachTurnResponse)
def coach_turn_route(
    body: CoachTurnRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        result = coach_turn(
            entry_text=body.entry_text,
            prompt=body.prompt,
            tags=body.tags,
            conversation=body.conversation,
            client=client,
        )
    except Exception:
        logger.exception("coach turn call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach turn failed"}
        )
    return CoachTurnResponse(text=result["text"], notes=result["notes"])


@app.post("/coach/reframe", response_model=CoachReframeResponse)
def coach_reframe_route(
    body: CoachReframeRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        result = coach_reframe(
            entry_text=body.entry_text,
            prompt=body.prompt,
            tags=body.tags,
            conversation=body.conversation,
            client=client,
        )
    except Exception:
        logger.exception("coach reframe call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach reframe failed"}
        )
    return CoachReframeResponse(reframed=result["reframed"], notes=result["notes"])
