"""
tools/data_tools.py
--------------------
Pure, deterministic tool functions that agents call to compute survey metrics.
These are registered as Groq/OpenAI function-calling tools so the DataAgent
can invoke them via LLM tool-calling (not just direct Python calls).

All functions accept a list of response dicts and optional date filters.
"""

from __future__ import annotations

import json
import os
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any

# Theme vocabulary for keyword-based classification
# Each theme maps to a list of keywords found in free_text
THEME_KEYWORDS: dict[str, list[str]] = {
    "food_quality":  ["food", "taste", "flavor", "fresh", "cold", "stale", "meal", "portion",
                       "ingredient", "dish", "bowl", "toast", "wrap", "coffee", "brew", "menu",
                       "cooked", "quality", "delicious", "soggy", "lukewarm"],
    "wait_time":     ["wait", "slow", "quick", "fast", "minutes", "queue", "line", "speed",
                       "rushed", "delay", "long", "ready", "took", "standing", "counter"],
    "staff":         ["staff", "service", "friendly", "rude", "cashier", "barista", "team",
                       "employee", "worker", "helpful", "attentive", "ignored", "unhelpful",
                       "warm", "welcoming", "smile", "attitude"],
    "cleanliness":   ["clean", "dirty", "mess", "hygiene", "restroom", "table", "spotless",
                       "tidy", "residue", "sticky", "utensil", "sanitize"],
    "price":         ["price", "expensive", "cheap", "value", "cost", "worth", "money",
                       "afford", "reward", "loyalty", "point", "discount", "premium"],
    "app":           ["app", "application", "mobile", "online", "order", "crash", "glitch",
                       "payment", "digital", "log", "update", "slow", "bug", "allergen"],
}


def _parse_date(date_str: str) -> date:
    return date.fromisoformat(date_str)


def filter_by_period(responses: list[dict], start: str, end: str) -> list[dict]:
    """Filter responses to those within [start, end] inclusive (ISO date strings).
    Uses fast lexicographical string comparison instead of datetime parsing.
    """
    return [r for r in responses if start <= r["date"] <= end]


def compute_csat(responses: list[dict]) -> float:
    """
    CSAT = percentage of responses with rating >= 4.
    Returns a float 0–100 (percentage).
    """
    if not responses:
        return 0.0
    satisfied = sum(1 for r in responses if r["rating"] >= 4)
    return round((satisfied / len(responses)) * 100, 2)


def compute_avg_rating(responses: list[dict]) -> float:
    """Average rating across all responses (1–5 scale)."""
    if not responses:
        return 0.0
    return round(sum(r["rating"] for r in responses) / len(responses), 3)


def rating_distribution(responses: list[dict]) -> dict[str, int]:
    """Returns count of each rating (1–5) as string keys."""
    dist: dict[str, int] = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    for r in responses:
        dist[str(r["rating"])] += 1
    return dist


def extract_top_themes(
    responses: list[dict],
    n: int = 5,
    min_rating: int | None = None,
    max_rating: int | None = None,
) -> list[dict]:
    """
    Classify each free-text response into themes using keyword matching.
    Optionally filter to a specific rating range first (e.g. max_rating=1
    for 1-star only, min_rating=4 for happy responses).
    Returns top-n themes sorted by frequency with count and percentage.
    """
    # Apply rating filter before theme extraction
    filtered = responses
    if min_rating is not None:
        filtered = [r for r in filtered if r["rating"] >= min_rating]
    if max_rating is not None:
        filtered = [r for r in filtered if r["rating"] <= max_rating]

    theme_counts: Counter = Counter()
    total = len(filtered)

    for r in filtered:
        text_lower = r.get("free_text", "").lower()
        matched_themes = set()
        for theme, keywords in THEME_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                matched_themes.add(theme)
        if not matched_themes:
            matched_themes.add("general")
        for theme in matched_themes:
            theme_counts[theme] += 1

    results = []
    for theme, count in theme_counts.most_common(n):
        results.append({
            "theme": theme,
            "count": count,
            "percentage": round((count / total) * 100, 2) if total else 0.0,
        })
    return results


def count_responses(responses: list[dict]) -> int:
    """Total number of responses."""
    return len(responses)


def responses_by_channel(responses: list[dict]) -> dict[str, int]:
    """Breakdown of response counts by channel."""
    counts: Counter = Counter(r.get("response_channel", "unknown") for r in responses)
    return dict(counts)


def csat_by_segment(
    responses: list[dict],
    channel: str | None = None,
    theme: str | None = None,
    min_rating: int | None = None,
    max_rating: int | None = None,
) -> dict:
    """
    Compute CSAT and avg_rating for a filtered segment.
    Supports filtering by channel (e.g. 'mobile'), theme keyword (e.g. 'staff'),
    and rating range. Any filter can be omitted (None = no filter).
    Returns count, csat, avg_rating for the matching segment.
    """
    filtered = responses

    # Filter by channel
    if channel:
        filtered = [r for r in filtered if r.get("response_channel", "").lower() == channel.lower()]

    # Filter by theme keyword match in free_text
    if theme:
        keywords = THEME_KEYWORDS.get(theme.lower(), [theme.lower()])
        filtered = [
            r for r in filtered
            if any(kw in r.get("free_text", "").lower() for kw in keywords)
        ]

    # Filter by rating range
    if min_rating is not None:
        filtered = [r for r in filtered if r["rating"] >= min_rating]
    if max_rating is not None:
        filtered = [r for r in filtered if r["rating"] <= max_rating]

    total = len(filtered)
    if total == 0:
        return {"segment": {"channel": channel, "theme": theme}, "count": 0, "csat": 0.0, "avg_rating": 0.0}

    return {
        "segment": {"channel": channel, "theme": theme, "min_rating": min_rating, "max_rating": max_rating},
        "count": total,
        "csat": compute_csat(filtered),
        "avg_rating": compute_avg_rating(filtered),
    }


def weekly_trend(
    responses: list[dict],
    start: str,
    end: str,
    metric: str = "csat",
) -> list[dict]:
    """
    Break the given date range into ISO-weeks and compute a metric per week.
    metric can be 'csat', 'avg_rating', or 'count'.
    Returns a list of {week, start_date, end_date, value} dicts sorted chronologically.
    """
    start_d = date.fromisoformat(start)
    end_d   = date.fromisoformat(end)

    # Build week buckets: each week starts on Monday
    # We group responses by ISO year-week string (e.g. "2026-W14")
    bucket: defaultdict[str, list[dict]] = defaultdict(list)
    for r in responses:
        if start <= r["date"] <= end:
            d = date.fromisoformat(r["date"])
            iso_week = d.strftime("%G-W%V")  # ISO year-week
            bucket[iso_week].append(r)

    results = []
    for week_key in sorted(bucket.keys()):
        week_responses = bucket[week_key]
        # Compute week date range from first/last record
        dates_in_week = sorted(r["date"] for r in week_responses)
        if metric == "csat":
            value = compute_csat(week_responses)
        elif metric == "avg_rating":
            value = compute_avg_rating(week_responses)
        else:  # count
            value = len(week_responses)
        results.append({
            "week": week_key,
            "start_date": dates_in_week[0],
            "end_date": dates_in_week[-1],
            "count": len(week_responses),
            "value": value,
            "metric": metric,
        })
    return results


def compare_themes(
    responses: list[dict],
    themes: list[str],
) -> list[dict]:
    """
    For each requested theme, compute csat, avg_rating, and count within the
    already-filtered responses. Used to compare one theme vs another
    (e.g. 'Is food_quality or staff causing more dissatisfaction?').
    Returns list sorted by avg_rating ascending (worst first).
    """
    results = []
    for theme in themes:
        keywords = THEME_KEYWORDS.get(theme.lower(), [theme.lower()])
        theme_responses = [
            r for r in responses
            if any(kw in r.get("free_text", "").lower() for kw in keywords)
        ]
        total = len(theme_responses)
        results.append({
            "theme": theme,
            "count": total,
            "csat": compute_csat(theme_responses),
            "avg_rating": compute_avg_rating(theme_responses),
            "percentage_of_total": round((total / len(responses)) * 100, 2) if responses else 0.0,
        })
    # Worst CSAT first
    results.sort(key=lambda x: x["csat"])
    return results


def theme_csat_by_period(responses: list[dict]) -> list[dict]:
    """
    For each known theme, compute CSAT, avg_rating, and count within the
    already-filtered responses. Designed to be called once per period so
    the LLM can compare per-theme CSAT across two periods.
    Returns list sorted by CSAT ascending (worst first).
    """
    results = []
    total = len(responses)
    for theme, keywords in THEME_KEYWORDS.items():
        theme_responses = [
            r for r in responses
            if any(kw in r.get("free_text", "").lower() for kw in keywords)
        ]
        count = len(theme_responses)
        results.append({
            "theme": theme,
            "count": count,
            "csat": compute_csat(theme_responses),
            "avg_rating": compute_avg_rating(theme_responses),
            "percentage_of_total": round((count / total) * 100, 2) if total else 0.0,
        })
    results.sort(key=lambda x: x["csat"])
    return results


# ──────────────────────────────────────────────────────────────────────────────
# Tool definitions for Groq / OpenAI function-calling schema
# ──────────────────────────────────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "compute_csat",
            "description": "Compute CSAT score (% of ratings >= 4) for a filtered set of responses.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format for filtering responses.",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date in YYYY-MM-DD format for filtering responses.",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compute_avg_rating",
            "description": "Compute the average rating (1-5) for a filtered set of responses.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "extract_top_themes",
            "description": (
                "Extract the most common complaint/praise themes from survey free text. "
                "Use min_rating/max_rating to restrict to a specific rating slice — for example, "
                "set max_rating=1 to get top themes among 1-star responses only, "
                "or min_rating=4 for top themes among satisfied customers."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                    "n": {"type": "integer", "description": "Number of top themes to return", "default": 5},
                    "min_rating": {"type": "integer", "description": "Only include responses with rating >= this value (1-5). Omit if not needed."},
                    "max_rating": {"type": "integer", "description": "Only include responses with rating <= this value (1-5). Omit if not needed."},
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rating_distribution",
            "description": "Get the count of each rating value (1-5) for a given period.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    # ── NEW TOOL: csat_by_segment ──────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "csat_by_segment",
            "description": (
                "Compute CSAT and avg_rating for a specific segment. "
                "Use when the query mentions a specific channel (mobile/web/kiosk/email), "
                "a specific theme (food_quality/wait_time/staff/cleanliness/price/app), "
                "or a rating range. Handles multi-dimensional questions like "
                "'what is CSAT for mobile users who complained about staff'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                    "channel":    {"type": "string", "description": "Filter by channel: mobile, web, kiosk, email. Omit if not needed."},
                    "theme":      {"type": "string", "description": "Filter by theme keyword: food_quality, wait_time, staff, cleanliness, price, app. Omit if not needed."},
                    "min_rating": {"type": "integer", "description": "Minimum rating (1-5) inclusive. Omit if not needed."},
                    "max_rating": {"type": "integer", "description": "Maximum rating (1-5) inclusive. Omit if not needed."},
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    # ── NEW TOOL: weekly_trend ─────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "weekly_trend",
            "description": (
                "Break a date range into ISO weeks and compute a metric per week. "
                "Use when the query asks about weekly trends, which week was worst/best, "
                "sudden spikes or drops, or weekly patterns within a month."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                    "metric": {
                        "type": "string",
                        "enum": ["csat", "avg_rating", "count"],
                        "description": "Metric to compute per week. Default: csat",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    # ── NEW TOOL: compare_themes ───────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "compare_themes",
            "description": (
                "Compare multiple themes against each other within a time period. "
                "Use when the query asks which issue is worse, how themes rank, "
                "or compares specific themes like 'is food_quality or staff the bigger problem'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                    "themes": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of themes to compare: food_quality, wait_time, staff, cleanliness, price, app",
                    },
                },
                "required": ["start_date", "end_date", "themes"],
            },
        },
    },
    # ── NEW TOOL: theme_csat_by_period ────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "theme_csat_by_period",
            "description": (
                "Compute CSAT and avg_rating for every theme within a date range. "
                "Use when the query asks about per-theme CSAT, which theme has the lowest satisfaction, "
                "or when comparing theme-level CSAT across two periods (call this tool once per period)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
]


def dispatch_tool(name: str, args: dict, responses: list[dict]) -> Any:
    """
    Execute a tool call by name.
    The `responses` list is the full dataset — filtering is applied inside each function.
    """
    start = args.get("start_date", "2026-01-01")
    end = args.get("end_date", "2026-12-31")
    filtered = filter_by_period(responses, start, end)

    if name == "compute_csat":
        return compute_csat(filtered)
    elif name == "compute_avg_rating":
        return compute_avg_rating(filtered)
    elif name == "extract_top_themes":
        return extract_top_themes(
            filtered,
            n=args.get("n", 5),
            min_rating=args.get("min_rating"),
            max_rating=args.get("max_rating"),
        )
    elif name == "rating_distribution":
        return rating_distribution(filtered)
    elif name == "count_responses":
        return count_responses(filtered)
    elif name == "csat_by_segment":
        return csat_by_segment(
            filtered,
            channel=args.get("channel"),
            theme=args.get("theme"),
            min_rating=args.get("min_rating"),
            max_rating=args.get("max_rating"),
        )
    elif name == "weekly_trend":
        return weekly_trend(responses, start, end, metric=args.get("metric", "csat"))
    elif name == "compare_themes":
        themes = args.get("themes", [])
        return compare_themes(filtered, themes)
    elif name == "theme_csat_by_period":
        return theme_csat_by_period(filtered)
    else:
        raise ValueError(f"Unknown tool: {name}")
