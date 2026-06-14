"""
agents/comparison_agent.py
---------------------------
ComparisonAgent: Compares two time periods and surfaces significant changes.

Receives a TaskSpec specifying two date ranges, runs DataAgent logic for each,
computes deltas, and identifies emerging/declining themes.

Note: We call data_agent.run() directly (not via orchestrator) since this is
an internal agent-to-agent composition, not a new orchestrator-level task.
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from providers.llm import get_llm
from schemas.models import ComparisonAgentResult, DataAgentResult, TaskSpec
import agents.data_agent as data_agent

load_dotenv()


def _theme_map(result: DataAgentResult) -> dict[str, float]:
    """Convert theme list to {theme: percentage} dict for easy delta computation."""
    return {t.theme: t.percentage for t in result.top_themes}


def identify_shifts(
    themes_a: dict[str, float],
    themes_b: dict[str, float],
    threshold: float = 5.0,
) -> tuple[list[str], list[str]]:
    """
    Compare theme percentages between periods.
    emerging: themes that grew by > threshold percentage points
    declining: themes that shrank by > threshold percentage points
    """
    all_themes = set(themes_a) | set(themes_b)
    emerging, declining = [], []

    for theme in all_themes:
        pct_a = themes_a.get(theme, 0.0)
        pct_b = themes_b.get(theme, 0.0)
        delta = pct_b - pct_a

        if delta > threshold:
            emerging.append(f"{theme} (+{delta:.1f}pp)")
        elif delta < -threshold:
            declining.append(f"{theme} ({delta:.1f}pp)")

    return emerging, declining


def run(
    task: TaskSpec,
    cached_result_a: DataAgentResult | None = None,
    cached_result_b: DataAgentResult | None = None,
) -> ComparisonAgentResult:
    """Execute the ComparisonAgent for a given TaskSpec.

    Args:
        task: TaskSpec with filters specifying the two periods.
        cached_result_a: Pre-computed DataAgentResult for period A (avoids re-running DataAgent).
        cached_result_b: Pre-computed DataAgentResult for period B (avoids re-running DataAgent).
    """
    filters = task.filters
    period_a_range = filters.get("period_a", {"start": "2026-04-01", "end": "2026-04-30"})
    period_b_range = filters.get("period_b", {"start": "2026-05-01", "end": "2026-05-31"})
    label_a = filters.get("label_a", "April 2026")
    label_b = filters.get("label_b", "May 2026")

    # ── Step 1: Use cached results or run DataAgent ───────────────────────────
    if cached_result_a is not None:
        result_a = cached_result_a
    else:
        task_a = TaskSpec(
            task_id=f"{task.task_id}_period_a",
            agent="data_agent",
            intent=f"Compute survey metrics for {label_a}",
            filters={"date_range": period_a_range, "period_label": label_a},
        )
        result_a = data_agent.run(task_a)

    if cached_result_b is not None:
        result_b = cached_result_b
    else:
        task_b = TaskSpec(
            task_id=f"{task.task_id}_period_b",
            agent="data_agent",
            intent=f"Compute survey metrics for {label_b}",
            filters={"date_range": period_b_range, "period_label": label_b},
        )
        result_b = data_agent.run(task_b)

    # ── Step 2: Compute deltas ────────────────────────────────────────────────
    delta_csat = round(result_b.csat_score - result_a.csat_score, 2)
    delta_avg  = round(result_b.avg_rating - result_a.avg_rating, 3)

    themes_a = _theme_map(result_a)
    themes_b = _theme_map(result_b)
    emerging, declining = identify_shifts(themes_a, themes_b)

    # ── Step 3: Generate insight summary with LLM ──────────────────────────────
    insight_prompt = (
        f"You are a business analyst. Compare these two periods for GreenLeaf Bistro:\n\n"
        f"Period A ({label_a}): CSAT={result_a.csat_score}%, avg_rating={result_a.avg_rating}, "
        f"responses={result_a.total_responses}\n"
        f"Period B ({label_b}): CSAT={result_b.csat_score}%, avg_rating={result_b.avg_rating}, "
        f"responses={result_b.total_responses}\n\n"
        f"CSAT delta: {delta_csat:+.1f}pp, Avg rating delta: {delta_avg:+.3f}\n"
        f"Emerging issues: {emerging or 'none'}\n"
        f"Declining issues: {declining or 'none'}\n\n"
        "Write a 1–2 sentence plain English summary of the most significant changes. "
        "Be direct and business-focused."
    )

    insight_summary = ""
    try:
        llm = get_llm()
        if llm.available:
            resp = llm.chat(messages=[{"role": "user", "content": insight_prompt}])
            insight_summary = resp.content.strip()
    except Exception as e:
        print(f"[ComparisonAgent] LLM error: {e}")

    # Deterministic fallback — never leaves insight_summary empty
    if not insight_summary:
        direction = "improved" if delta_csat >= 0 else "declined"
        e_str = f"; emerging: {', '.join(emerging)}" if emerging else ""
        d_str = f"; declining: {', '.join(declining)}" if declining else ""
        insight_summary = (
            f"CSAT {direction} by {abs(delta_csat):.1f}pp from {label_a} to {label_b}"
            f"{e_str}{d_str}."
        )

    return ComparisonAgentResult(
        period_a=result_a,
        period_b=result_b,
        delta_csat=delta_csat,
        delta_avg_rating=delta_avg,
        emerging_themes=emerging,
        declining_themes=declining,
        insight_summary=insight_summary,
    )
