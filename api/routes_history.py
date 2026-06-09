"""
api/routes_history.py
----------------------
GET /api/history
"""
from __future__ import annotations

import os
import sys

from fastapi import APIRouter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.config_manager import read_history

router = APIRouter(prefix="/api")


@router.get("/history")
def get_history():
    return {"runs": read_history(limit=50)}
