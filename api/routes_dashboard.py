"""
api/routes_dashboard.py
-----------------------
GET /api/dashboard?period=may
Returns computed KPIs + AI-generated executive brief and insights.
"""
from __future__ import annotations

import json
import os
import sys
import time

from fastapi import APIRouter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.data_tools import (
    filter_by_period, compute_csat, compute_avg_rating,
    extract_top_themes, rating_distribution, responses_by_channel, count_responses
)
from providers.llm import get_llm

router = APIRouter(prefix="/api")

PERIOD_RANGES = {
    "jan": ("2026-01-01", "2026-01-31", "January 2026"),
    "feb": ("2026-02-01", "2026-02-28", "February 2026"),
    "mar": ("2026-03-01", "2026-03-31", "March 2026"),
    "apr": ("2026-04-01", "2026-04-30", "April 2026"),
    "may": ("2026-05-01", "2026-05-31", "May 2026"),
}

PREV_PERIOD = {"feb": "jan", "mar": "feb", "apr": "mar", "may": "apr"}

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "survey_responses.json")


_cache: dict = {"data": None, "mtime": 0.0}

def _load_responses():
    """Load survey data, re-reading if file was modified."""
    try:
        mtime = os.path.getmtime(DATA_PATH)
        if _cache["data"] is None or _cache["mtime"] != mtime:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
            _cache["data"] = tuple(raw["responses"])
            _cache["mtime"] = mtime
        return _cache["data"]
    except Exception:
        return ()


def _compute_period_kpis(period_key: str) -> dict:
    if period_key not in PERIOD_RANGES:
        period_key = "may"
    start, end, label = PERIOD_RANGES[period_key]
    responses = list(_load_responses())
    filtered = filter_by_period(responses, start, end)

    csat = compute_csat(filtered)
    avg_rating = compute_avg_rating(filtered)
    total = count_responses(filtered)
    themes = extract_top_themes(filtered, 6)
    rating_dist = rating_distribution(filtered)
    channels = responses_by_channel(filtered)

    top_complaint = themes[0]["theme"] if themes else "unknown"

    # Health score formula
    # CSAT component (0-40 pts): csat * 0.4
    # Rating component (0-30 pts): (avg_rating/5) * 30
    # Theme severity (0-30 pts): penalise if top complaint > 30%
    csat_pts = csat * 0.4
    rating_pts = (avg_rating / 5) * 30
    top_pct = themes[0]["percentage"] if themes else 0
    severity_pts = max(0, 30 - (top_pct - 20) * 0.5) if top_pct > 20 else 30
    health_score = round(csat_pts + rating_pts + severity_pts)
    health_score = max(0, min(100, health_score))

    # MoM delta
    mom_delta = None
    prev_key = PREV_PERIOD.get(period_key)
    if prev_key and prev_key in PERIOD_RANGES:
        ps, pe, _ = PERIOD_RANGES[prev_key]
        prev_filtered = filter_by_period(responses, ps, pe)
        if prev_filtered:
            prev_csat = compute_csat(prev_filtered)
            mom_delta = round(csat - prev_csat, 2)

    return {
        "period": label,
        "csat_score": round(csat, 2),
        "avg_rating": round(avg_rating, 3),
        "total_responses": total,
        "mom_delta_csat": mom_delta,
        "top_themes": themes,
        "rating_distribution": rating_dist,
        "channels": channels,
        "health_score": health_score,
        "top_complaint": top_complaint,
    }


def _build_ai_insights(kpis: dict) -> dict:
    csat = kpis["csat_score"]
    health = kpis["health_score"]
    themes = kpis["top_themes"]
    mom = kpis.get("mom_delta_csat")

    # Build insights list without LLM (always available)
    insights = []
    if themes:
        top = themes[0]
        insights.append({
            "icon": "⚠️",
            "text": f"{top['theme'].replace('_', ' ').title()} is the top issue at {top['percentage']:.1f}% of responses.",
            "type": "warning",
        })
    if mom is not None:
        direction = "fell" if mom < 0 else "rose"
        insights.append({
            "icon": "↓" if mom < 0 else "↑",
            "text": f"CSAT {direction} {abs(mom):.1f}pp month-over-month.",
            "type": "trend" if mom < 0 else "positive",
        })
    if len(themes) > 1:
        best = max(themes, key=lambda t: t["percentage"])
        if best["theme"] == "staff":
            insights.append({
                "icon": "✓",
                "text": "Staff remains a positive signal — keep investing in service quality.",
                "type": "positive",
            })
    insights.append({
        "icon": "📌",
        "text": f"Business Health Score is {health}/100 — {'action required' if health < 40 else 'monitor closely' if health < 70 else 'on track'}.",
        "type": "info",
    })

    # Derive AI KPIs
    top_theme_label = themes[0]["theme"].replace("_", " ").title() if themes else "Unknown"
    second_theme = themes[1] if len(themes) > 1 else None
    fastest_growing = "App / Digital" if any(t["theme"] == "app" for t in themes[:2]) else top_theme_label

    operational_priority = f"{top_theme_label} complaints"
    highest_risk = f"{top_theme_label} ({themes[0]['percentage']:.1f}% of complaints)" if themes else "Unknown"
    best_area = "Staff" if any(t["theme"] == "staff" and t["percentage"] < 30 for t in themes) else "Food Quality"

    # Executive brief — try LLM, fallback to template
    brief = _generate_brief(kpis)

    return {
        "executive_brief": brief,
        "insights": insights[:5],
        "operational_priority": operational_priority,
        "highest_risk_area": highest_risk,
        "fastest_growing_issue": fastest_growing,
        "best_performing_area": best_area,
    }


def _generate_brief(kpis: dict) -> str:
    """Generate AI executive brief via LLM or fall back to template."""
    period = kpis["period"]
    csat = kpis["csat_score"]
    avg = kpis["avg_rating"]
    total = kpis["total_responses"]
    themes = kpis["top_themes"]
    mom = kpis.get("mom_delta_csat")
    health = kpis["health_score"]
    top_theme = themes[0]["theme"].replace("_", " ") if themes else "app"
    top_pct = themes[0]["percentage"] if themes else 0

    # Template fallback
    mom_str = f", a {abs(mom):.1f}pp {'decline' if mom and mom < 0 else 'improvement'} month-over-month" if mom is not None else ""
    template = (
        f"GreenLeaf Bistro recorded a CSAT of {csat:.1f}% in {period} across {total:,} responses"
        f"{mom_str}, with an average rating of {avg:.2f}/5. "
        f"The primary driver of dissatisfaction is {top_theme} at {top_pct:.1f}% of responses. "
        f"The overall Business Health Score of {health}/100 indicates "
        f"{'a critical situation requiring immediate intervention' if health < 40 else 'areas of concern that require attention' if health < 70 else 'stable operations with room for improvement'}."
    )

    try:
        llm = get_llm()
        if not llm.available:
            return template
        themes_str = ", ".join(f"{t['theme']} ({t['percentage']:.1f}%)" for t in themes[:4])
        prompt = (
            f"Write a 3-sentence executive brief for GreenLeaf Bistro based on this data:\n"
            f"Period: {period}\nCSAT: {csat:.1f}%\nAvg Rating: {avg:.2f}/5\n"
            f"Total Responses: {total:,}\nMoM CSAT Delta: {mom}pp\n"
            f"Top Themes: {themes_str}\nHealth Score: {health}/100\n\n"
            f"Be specific with numbers. Focus on business impact and key risk areas."
        )
        resp = llm.chat([{"role": "user", "content": prompt}])
        if resp.content and len(resp.content) > 50:
            return resp.content.strip()
    except Exception:
        pass
    return template


@router.get("/dashboard")
def dashboard_endpoint(period: str = "may"):
    kpis = _compute_period_kpis(period)
    ai = _build_ai_insights(kpis)
    return {"kpis": kpis, "ai": ai}
