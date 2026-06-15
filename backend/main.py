import logging

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Literal

from auth import get_current_user, UserClaims
from brag_doc import GroupBy, generate_brag_doc
from coach import Message, UserContext, coach_reframe, coach_turn
from rate_limit import enforce_rate_limit
from utils import OutputGuardrailError

load_dotenv()

logger = logging.getLogger("backend")

COACH_FALLBACK_TEXT = (
    "Let's keep the focus on your entry — what would you like to work on?"
)

app = FastAPI(title="Confidence Journal Backend")


def get_anthropic_client() -> Anthropic:
    return Anthropic()

CoachingStyle = Literal[
    "trusted-mentor", "hype-woman", "direct-challenger", "bold-coach"
]


class Entry(BaseModel):
    id: str = Field(max_length=100)
    date: str = Field(max_length=30)
    prompt: str = Field(max_length=500)
    original: str = Field(max_length=10_000)
    reframed: str | None = Field(default=None, max_length=10_000)
    tags: list[str] = Field(max_length=50)
    createdAt: str = Field(max_length=50)
    coachNotes: list[str] | None = Field(default=None, max_length=50)


class BragDocGroup(BaseModel):
    tag: str
    points: list[str]


class BragDocResponse(BaseModel):
    bullets: list[BragDocGroup]


class BragDocRequest(BaseModel):
    entries: list[Entry] = Field(max_length=1_000)
    groupBy: GroupBy = "tag"
    userPrompt: str | None = Field(default=None, max_length=2_000)
    user_context: UserContext | None = None


class CoachTurnRequest(BaseModel):
    entry_text: str = Field(max_length=10_000)
    prompt: str = Field(max_length=500)
    tags: list[str] = Field(max_length=50)
    conversation: list[Message] = Field(max_length=50)
    user_context: UserContext | None = None
    coaching_style: CoachingStyle = "trusted-mentor"


class CoachTurnResponse(BaseModel):
    text: str
    notes: list[str]


class CoachReframeRequest(BaseModel):
    entry_text: str = Field(max_length=10_000)
    prompt: str = Field(max_length=500)
    tags: list[str] = Field(max_length=50)
    conversation: list[Message] = Field(max_length=50)
    user_context: UserContext | None = None
    coaching_style: CoachingStyle = "trusted-mentor"


class CoachReframeResponse(BaseModel):
    reframed: str
    notes: list[str]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-brag-doc", response_model=BragDocResponse)
def brag_doc_route(
    body: BragDocRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("brag_doc")),
):
    logger.info("brag doc request", extra={"user_id": user.user_id})
    try:
        result = generate_brag_doc(
            entries=[e.model_dump() for e in body.entries],
            group_by=body.groupBy,
            user_prompt=body.userPrompt,
            user_context=body.user_context,
            client=client,
        )
    except OutputGuardrailError:
        logger.warning("brag doc output guardrail tripped", extra={"user_id": user.user_id})
        return JSONResponse(
            status_code=500, content={"error": "Brag doc generation failed"}
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
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("coach_turn")),
):
    logger.info("coach turn request", extra={"user_id": user.user_id})
    try:
        result = coach_turn(
            entry_text=body.entry_text,
            prompt=body.prompt,
            tags=body.tags,
            conversation=body.conversation,
            coaching_style=body.coaching_style,
            user_context=body.user_context,
            client=client,
        )
    except OutputGuardrailError:
        logger.warning("coach turn output guardrail tripped", extra={"user_id": user.user_id})
        return CoachTurnResponse(text=COACH_FALLBACK_TEXT, notes=[])
    except Exception:
        logger.exception("coach turn call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach turn failed"}
        )
    return CoachTurnResponse(text=result["text"], notes=result["notes"])


@app.post("/coach/reframe", response_model=CoachReframeResponse)
def coach_reframe_route(
    body: CoachReframeRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
    _rl: None = Depends(enforce_rate_limit("coach_reframe")),
):
    logger.info("coach reframe request", extra={"user_id": user.user_id})
    try:
        result = coach_reframe(
            entry_text=body.entry_text,
            prompt=body.prompt,
            tags=body.tags,
            conversation=body.conversation,
            coaching_style=body.coaching_style,
            user_context=body.user_context,
            client=client,
        )
    except OutputGuardrailError:
        logger.warning("coach reframe output guardrail tripped", extra={"user_id": user.user_id})
        return CoachReframeResponse(reframed=COACH_FALLBACK_TEXT, notes=[])
    except Exception:
        logger.exception("coach reframe call failed")
        return JSONResponse(
            status_code=500, content={"error": "Coach reframe failed"}
        )
    return CoachReframeResponse(reframed=result["reframed"], notes=result["notes"])
