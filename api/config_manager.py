"""
api/config_manager.py
---------------------
Reads and writes config/config.json and config/prompts.json.
Also manages run_history.jsonl.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "config", "config.json")
PROMPTS_PATH = os.path.join(ROOT, "config", "prompts.json")
HISTORY_PATH = os.path.join(ROOT, "config", "run_history.jsonl")

_DEFAULT_CONFIG = {
    "provider": os.getenv("LLM_PROVIDER", "openrouter"),
    "model": os.getenv("LLM_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free"),
    "api_keys": {
        "groq": os.getenv("GROQ_API_KEY", ""),
        "openai": os.getenv("OPENAI_API_KEY", ""),
        "gemini": os.getenv("GEMINI_API_KEY", ""),
        "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
        "grok": os.getenv("GROK_API_KEY", ""),
        "openrouter": os.getenv("OPENROUTER_API_KEY", ""),
    },
    "embedding_model": "all-MiniLM-L6-v2",
    "retrieval": {"top_k": 3, "strategy": "qa_block", "score_threshold": 0.1},
    "active_kb": "default",
    "active_dataset": "survey_responses.json",
    "temperature": 0.3,
    "max_tokens": 512,
}

_DEFAULT_PROMPTS = {
    "orchestrator": "You are the Orchestrator for MiniSense, a survey analytics system for GreenLeaf Bistro.",
    "data_agent": "You are DataAgent, a precise survey analytics engine. Call tools to gather metrics.",
    "rag_agent": "You are RAGAgent. Summarize retrieved FAQ chunks in 2-3 sentences.",
    "summary_agent": "You are SummaryAgent. Synthesize all data into a business-language narrative.",
}


def read_config() -> dict:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Merge with defaults for any missing keys
        merged = {**_DEFAULT_CONFIG, **data}
        merged["retrieval"] = {**_DEFAULT_CONFIG["retrieval"], **data.get("retrieval", {})}
        merged["api_keys"] = {**_DEFAULT_CONFIG["api_keys"], **data.get("api_keys", {})}
        return merged
    except Exception:
        return dict(_DEFAULT_CONFIG)


def write_config(updates: dict) -> None:
    current = read_config()
    # Deep merge retrieval
    if "retrieval" in updates:
        current["retrieval"] = {**current.get("retrieval", {}), **updates.pop("retrieval")}
    # Deep merge api_keys — but NEVER overwrite with a masked value (contains •)
    # The GET /api/config endpoint returns masked keys; if the user didn't retype a key,
    # the masked version gets POSTed back. We detect this and preserve the stored key.
    if "api_keys" in updates:
        incoming_keys = updates.pop("api_keys")
        existing_keys = current.get("api_keys", {})
        for provider, val in incoming_keys.items():
            if val and "\u2022" not in val:  # \u2022 == • (bullet = masked placeholder)
                existing_keys[provider] = val
            # else: skip — user didn't change this key
        current["api_keys"] = existing_keys
    # Strip leading ★ from model names saved from Admin Center dropdowns
    if "model" in updates and updates["model"]:
        updates["model"] = updates["model"].lstrip("★ ")
    current.update(updates)
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)


def read_prompts() -> dict:
    try:
        with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return dict(_DEFAULT_PROMPTS)


def write_prompt(agent: str, prompt: str) -> None:
    prompts = read_prompts()
    prompts[agent] = prompt
    os.makedirs(os.path.dirname(PROMPTS_PATH), exist_ok=True)
    with open(PROMPTS_PATH, "w", encoding="utf-8") as f:
        json.dump(prompts, f, indent=2)


def append_run(record: dict) -> None:
    """Append a run record to run_history.jsonl (max 200 records kept)."""
    os.makedirs(os.path.dirname(HISTORY_PATH), exist_ok=True)
    records = read_history()
    records.insert(0, {**record, "timestamp": datetime.now(timezone.utc).isoformat()})
    records = records[:200]
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")


def read_history(limit: int = 50) -> list[dict]:
    try:
        with open(HISTORY_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
        records = []
        for line in lines:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except Exception:
                    pass
        return records[:limit]
    except Exception:
        return []
