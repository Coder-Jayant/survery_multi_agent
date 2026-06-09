"""
api/routes_data.py
-------------------
GET  /api/data/list
POST /api/data/generate
"""
from __future__ import annotations

import os
import sys
import subprocess

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

router = APIRouter(prefix="/api/data")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


class GenerateRequest(BaseModel):
    months: Optional[list[str]] = None
    records: Optional[int] = None


@router.get("/list")
def list_datasets():
    datasets = []
    for f in os.listdir(DATA_DIR):
        if f.endswith(".json") and "survey" in f.lower():
            datasets.append(f)
    return {"datasets": datasets}


@router.post("/generate")
def generate_dataset(req: GenerateRequest):
    try:
        gen_script = os.path.join(DATA_DIR, "generate_data.py")
        result = subprocess.run(
            [sys.executable, gen_script],
            capture_output=True, text=True, timeout=300,
            cwd=ROOT
        )
        if result.returncode == 0:
            return {"message": "Dataset generated successfully.", "file": "survey_responses.json"}
        return {"message": f"Generation failed: {result.stderr[:200]}", "file": ""}
    except subprocess.TimeoutExpired:
        return {"message": "Generation timed out.", "file": ""}
    except Exception as e:
        return {"message": f"Error: {str(e)}", "file": ""}
