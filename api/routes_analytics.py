"""
api/routes_analytics.py
------------------------
GET /api/analytics/trends
GET /api/analytics/compare?a=apr&b=may
GET /api/analytics/channels?period=may
All computed directly from survey data — no LLM involved.
"""
from __future__ import annotations

import json
import os
import sys

from fastapi import APIRouter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.data_tools import (
    filter_by_period, compute_csat, compute_avg_rating,
    extract_top_themes, rating_distribution, responses_by_channel, count_responses
)
from api.routes_dashboard import _load_responses, PERIOD_RANGES

router = APIRouter(prefix="/api/analytics")


def _period_metrics(period_key: str) -> dict:
    if period_key not in PERIOD_RANGES:
        return {}
    start, end, label = PERIOD_RANGES[period_key]
    responses = list(_load_responses())
    filtered = filter_by_period(responses, start, end)
    if not filtered:
        return {"month": period_key, "label": label, "csat_score": 0, "avg_rating": 0,
                "total_responses": 0, "top_themes": [], "rating_distribution": {}, "channels": {}}
    return {
        "month": period_key,
        "label": label,
        "csat_score": round(compute_csat(filtered), 2),
        "avg_rating": round(compute_avg_rating(filtered), 3),
        "total_responses": count_responses(filtered),
        "top_themes": extract_top_themes(filtered, 6),
        "rating_distribution": rating_distribution(filtered),
        "channels": responses_by_channel(filtered),
    }


@router.get("/trends")
def analytics_trends():
    months = [_period_metrics(k) for k in ["jan", "feb", "mar", "apr", "may"]]
    months = [m for m in months if m]
    return {"months": months}


@router.get("/compare")
def analytics_compare(a: str = "apr", b: str = "may"):
    return {
        "period_a": _period_metrics(a),
        "period_b": _period_metrics(b),
    }


@router.get("/channels")
def analytics_channels(period: str = "may"):
    return _period_metrics(period).get("channels", {})
