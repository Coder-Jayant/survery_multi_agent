"""
POST /api/chatbot
-----------------
Backend proxy for the floating chatbot widget.
Routes through the configured LLM provider so the API key
never appears in the client JS bundle.
"""
from __future__ import annotations

import os
import json
import httpx

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api")

GROQ_API = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"

class ChatbotRequest(BaseModel):
    messages: list[dict]
    model: str = DEFAULT_MODEL
    max_tokens: int = 300
    temperature: float = 0.5


@router.post("/chatbot")
async def chatbot(req: ChatbotRequest):
    # Resolve key: env var first, then config.json
    key = os.environ.get("CHATBOT_GROQ_KEY") or os.environ.get("GROQ_API_KEY", "")

    if not key:
        try:
            cfg_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "config", "config.json"
            )
            with open(cfg_path) as f:
                cfg = json.load(f)
            key = cfg.get("api_keys", {}).get("groq", "")
        except Exception:
            key = ""

    if not key:
        raise HTTPException(status_code=503, detail="Chatbot API key not configured on server.")

    payload = {
        "model": req.model,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "messages": req.messages,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_API,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return {"reply": reply}
