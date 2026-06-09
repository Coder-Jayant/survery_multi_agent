"""
api/routes_config.py
---------------------
GET /api/config
PUT /api/config
"""
from __future__ import annotations

import os
import sys

from fastapi import APIRouter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.config_manager import read_config, write_config

router = APIRouter(prefix="/api")


@router.get("/config")
def get_config():
    cfg = read_config()
    # Mask API keys in response (show only first 8 chars)
    masked = dict(cfg)
    masked_keys = {}
    for provider, key in cfg.get("api_keys", {}).items():
        if key and len(key) > 8:
            masked_keys[provider] = key[:8] + "•" * (len(key) - 8)
        else:
            masked_keys[provider] = key
    masked["api_keys"] = masked_keys
    return masked


@router.put("/config")
def update_config(updates: dict):
    write_config(updates)
    # Reset LLM singleton so next request re-reads the new provider/model/key
    try:
        from providers.llm import reset_llm
        reset_llm()
    except Exception:
        pass
    return {"message": "Configuration saved successfully."}
