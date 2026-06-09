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
from datetime import date
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
    """Filter responses to those within [start, end] inclusive (ISO date strings)."""
    s, e = _parse_date(start), _parse_date(end)
    return [r for r in responses if s <= _parse_date(r["date"]) <= e]


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


def extract_top_themes(responses: list[dict], n: int = 5) -> list[dict]:
    """
    Classify each free-text response into themes using keyword matching.
    Returns top-n themes sorted by frequency with count and percentage.
    """
    theme_counts: Counter = Counter()
    total = len(responses)

    for r in responses:
        text_lower = r.get("free_text", "").lower()
        matched_themes = set()
        for theme, keywords in THEME_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                matched_themes.add(theme)
        # If no theme matched, label as "general"
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
            "description": "Extract the most common complaint/praise themes from survey free text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end_date":   {"type": "string", "description": "End date YYYY-MM-DD"},
                    "n": {"type": "integer", "description": "Number of top themes to return", "default": 5},
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
        return extract_top_themes(filtered, n=args.get("n", 5))
    elif name == "rating_distribution":
        return rating_distribution(filtered)
    elif name == "count_responses":
        return count_responses(filtered)
    else:
        raise ValueError(f"Unknown tool: {name}")
