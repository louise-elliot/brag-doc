import logging

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from brag_doc import GroupBy, generate_brag_doc
from reframe import reframe

load_dotenv()

logger = logging.getLogger("backend")

app = FastAPI(title="Confidence Journal Backend")


def get_anthropic_client() -> Anthropic:
    return Anthropic()


class ReframeRequest(BaseModel):
    text: str


class ReframeResponse(BaseModel):
    reframed: str


class Entry(BaseModel):
    id: str
    date: str
    prompt: str
    original: str
    reframed: str | None = None
    tags: list[str]
    createdAt: str


class BragDocRequest(BaseModel):
    entries: list[Entry]
    groupBy: GroupBy = "tag"
    userPrompt: str | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/reframe", response_model=ReframeResponse)
def reframe_route(
    body: ReframeRequest,
    client: Anthropic = Depends(get_anthropic_client),
):
    try:
        reframed = reframe(body.text, client)
    except Exception:
        logger.exception("reframe call failed")
        return JSONResponse(status_code=500, content={"error": "Reframe failed"})
    return ReframeResponse(reframed=reframed)


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
