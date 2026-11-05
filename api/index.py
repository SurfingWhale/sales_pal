"""Script Intelligence API (PRD-023): FastAPI, deployed by Vercel as a Python
Function next to the Next.js app; next.config.mjs rewrites
/api/script-intelligence/* here (and to a local uvicorn in dev and tests).

POST /api/script-intelligence/analyze — rules only (rules-v1), no model and no
paid call (PRD-022 §5, budget Rp 0). The conversation is analysed in memory
and not kept here; the app stores the result only when the seller chooses to
(users/{uid}/analyses or the guild's, with its own retention).

Sign-in: the same Firebase ID token the app's other routes take
(lib/serverAuth.ts). Under the emulator (FIREBASE_AUTH_EMULATOR_HOST) tokens
are checked by the emulator.
"""
from __future__ import annotations

import os
import sys
from typing import Literal, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.dirname(__file__))
from _intel.analyze import run  # noqa: E402

app = FastAPI(title="SalesPal Script Intelligence", docs_url=None, redoc_url=None, openapi_url=None)

MAX_TEXT = 20_000
MAX_SCRIPTS = 200


class Script(BaseModel):
    id: str = Field(max_length=200)
    title: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=4000)
    stage: Optional[str] = Field(default=None, max_length=20)
    categories: Optional[list[str]] = None
    workflow: Optional[str] = Field(default=None, max_length=20)
    archived: Optional[bool] = None


class AnalyzeIn(BaseModel):
    conversation_text: str = Field(min_length=1, max_length=MAX_TEXT)
    seller_role: Optional[str] = Field(default=None, max_length=60, description="The seller's name as it appears in the chat")
    prospect_name: Optional[str] = Field(default=None, max_length=80)
    business_context: Optional[str] = Field(default=None, max_length=200)
    tone_preference: Optional[Literal["santai", "formal"]] = None
    channel: Optional[Literal["wa", "dm"]] = None
    # The seller's own script library, sent by the app (it already holds it, scoped
    # to the workspace); the API keeps no copy.
    scripts: list[Script] = Field(default_factory=list, max_length=MAX_SCRIPTS)


_auth_ready = False


def _verify(authorization: str | None) -> str:
    """The uid behind a Firebase ID token, or 401."""
    global _auth_ready
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Masuk dulu.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        import firebase_admin
        from firebase_admin import auth
        if not _auth_ready:
            if not firebase_admin._apps:
                project = os.environ.get("FIREBASE_PROJECT_ID") or os.environ.get("NEXT_PUBLIC_FIREBASE_PROJECT_ID") or os.environ.get("GCLOUD_PROJECT")
                firebase_admin.initialize_app(options={"projectId": project} if project else None)
            _auth_ready = True
        return auth.verify_id_token(token)["uid"]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Sesi habis. Masuk lagi.")


@app.get("/api/script-intelligence/health")
def health():
    return {"ok": True, "engine": "rules-v1"}


@app.post("/api/script-intelligence/analyze")
def analyze(body: AnalyzeIn, authorization: str | None = Header(default=None)):
    _verify(authorization)
    scripts = [s.model_dump() for s in body.scripts]
    return run(body.conversation_text, scripts, seller_name=body.seller_role, business_context=body.business_context,
               tone_preference=body.tone_preference, channel=body.channel, prospect_name=body.prospect_name)
