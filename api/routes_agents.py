"""
api/routes_agents.py
---------------------
GET /api/agents/prompts
PUT /api/agents/prompts/{agent}
"""
from __future__ import annotations

import os
import sys

from fastapi import APIRouter
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.config_manager import read_prompts, write_prompt

router = APIRouter(prefix="/api/agents")


class PromptUpdate(BaseModel):
    prompt: str


@router.get("/prompts")
def get_prompts():
    return read_prompts()


@router.put("/prompts/{agent}")
def update_prompt(agent: str, body: PromptUpdate):
    valid_agents = ["orchestrator", "data_agent", "rag_agent", "summary_agent"]
    if agent not in valid_agents:
        return {"error": f"Unknown agent '{agent}'. Valid: {valid_agents}"}
    write_prompt(agent, body.prompt)
    return {"message": f"Prompt for {agent} updated successfully."}
