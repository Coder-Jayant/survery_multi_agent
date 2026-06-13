"""
tools/viz_builder.py
--------------------
Rule-based, data-shape-driven visualization selector.

Decision priority (data presence beats keyword guessing):
  1. weekly_data present          → line chart (time series)
  2. theme_comparison_data present → heatbar (ranked theme comparison)
  3. segment_data present          → scorecard (single metric spotlight)
  4. Multiple comparison results   → grouped_bar or table (multi-period)
  5. Single comparison result      → table with delta column
  6. Single period + themes        → horizontal bar
  7. Single period + ratings       → bar (rating dist)
  8. RAG-only                      → None

Zero LLM calls. Zero token cost. Data drives everything.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from schemas.models import DataAgentResult, ComparisonAgentResult, VizSpec

THEME_COLORS  = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6", "#ec4899"]
PERIOD_COLORS = ["#6366f1", "#22c55e"]
RATING_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"]
LINE_GRADIENT = ["#6366f1"]


def _csat_color(csat: float) -> str:
    """Return a hex color on a red→amber→green gradient for a CSAT value."""
    if csat >= 60:
        return "#22c55e"
    if csat >= 40:
        return "#f59e0b"
    return "#ef4444"


def build_visualization(
    question: str,
    data_result=None,
    comparison_result=None,
    all_comparison_results=None,
):
    """
    Return a VizSpec or None.
    Inspection order: new rich tool data first, then comparison, then single period.
    """
    try:
        from schemas.models import VizSpec
    except ImportError:
        return None

    # ── BRANCH 1: weekly_data present → line chart ────────────────────────────
    # Triggered when data_agent called weekly_trend tool. Highest priority.
    if data_result and data_result.weekly_data:
        weeks = data_result.weekly_data
        metric = weeks[0].get("metric", "csat") if weeks else "csat"
        unit   = "%" if metric in ("csat", "avg_rating") else "responses"
        label  = "CSAT" if metric == "csat" else ("Avg Rating" if metric == "avg_rating" else "Responses")
        period = data_result.period_label

        return VizSpec(
            type="line",
            title=f"Weekly {label} Trend — {period}",
            data=[
                {
                    "week": w["week"],
                    "label": w["start_date"][5:],   # "MM-DD" for compact x-axis
                    "value": round(w["value"], 2),
                    "count": w["count"],
                }
                for w in weeks
            ],
            x_key="label",
            value_key="value",
            unit=unit,
            colors=LINE_GRADIENT,
        )

    # ── BRANCH 2: theme_comparison_data → heatbar ─────────────────────────────
    # Triggered when data_agent called compare_themes tool.
    if data_result and data_result.theme_comparison_data:
        rows = data_result.theme_comparison_data   # already sorted worst CSAT first
        period = data_result.period_label

        return VizSpec(
            type="heatbar",
            title=f"Theme CSAT Ranking — {period}",
            data=[
                {
                    "theme": r["theme"].replace("_", " ").title(),
                    "csat":  round(r["csat"], 1),
                    "count": r["count"],
                    "avg_rating": round(r["avg_rating"], 2),
                    "color": _csat_color(r["csat"]),
                }
                for r in rows
            ],
            x_key="theme",
            value_key="csat",
            unit="%",
            colors=[_csat_color(r["csat"]) for r in rows],
        )

    # ── BRANCH 2b: theme_csat_data → grouped_bar (per-theme CSAT) ───────────────
    # Triggered when data_agent called theme_csat_by_period tool.
    # Useful for queries like "which theme has the lowest satisfaction" or
    # "compare themes and their CSAT".
    if data_result and data_result.theme_csat_data:
        rows = data_result.theme_csat_data  # sorted worst CSAT first
        period = data_result.period_label

        return VizSpec(
            type="grouped_bar",
            title=f"Per-Theme CSAT & Avg Rating — {period}",
            data=[
                {
                    "theme": r["theme"].replace("_", " ").title(),
                    "CSAT %": round(r["csat"], 1),
                    "Avg Rating": round(r["avg_rating"] * 20, 1),  # scale /5 to /100 for same axis
                    "count": r["count"],
                }
                for r in rows if r["count"] > 0
            ],
            x_key="theme",
            y_keys=["CSAT %", "Avg Rating"],
            unit="%",
            colors=["#6366f1", "#22c55e"],
        )

    # ── BRANCH 3: segment_data → scorecard ────────────────────────────────────
    # Triggered when data_agent called csat_by_segment tool.
    if data_result and data_result.segment_data:
        seg = data_result.segment_data
        segment_info = seg.get("segment", {})
        parts = [v for v in segment_info.values() if v is not None]
        seg_label = " + ".join(str(p) for p in parts) if parts else "Segment"
        period = data_result.period_label

        return VizSpec(
            type="scorecard",
            title=f"Segment Analysis — {period}",
            data=[
                {"label": "Segment", "value": seg_label},
                {"label": "CSAT",    "value": f"{seg.get('csat', 0):.1f}%",
                 "color": _csat_color(seg.get("csat", 0))},
                {"label": "Avg Rating", "value": f"{seg.get('avg_rating', 0):.2f} / 5"},
                {"label": "Responses",  "value": f"{seg.get('count', 0):,}"},
                # Overall CSAT for context delta
                {"label": "Overall CSAT", "value": f"{data_result.csat_score:.1f}%"},
            ],
            x_key="label",
            value_key="value",
            unit="%",
            colors=[_csat_color(seg.get("csat", 0))],
        )

    # ── BRANCH 4: multiple comparison results → period trend bar ──────────────
    if all_comparison_results and len(all_comparison_results) > 1:
        seen: set = set()
        periods = []
        for comp in all_comparison_results:
            for period in [comp.period_a, comp.period_b]:
                if period.period_label not in seen:
                    periods.append(period)
                    seen.add(period.period_label)

        # If 3+ distinct periods → line is better than bar
        if len(periods) >= 3:
            return VizSpec(
                type="line",
                title=f"CSAT Trend: {periods[0].period_label} → {periods[-1].period_label}",
                data=[
                    {
                        "label": p.period_label,
                        "value": p.csat_score,
                        "count": p.total_responses,
                    }
                    for p in periods
                ],
                x_key="label",
                value_key="value",
                unit="%",
                colors=LINE_GRADIENT,
            )

        # 2 periods → table with delta
        a, b = periods[0], periods[1]
        best_comp = all_comparison_results[-1]
        return VizSpec(
            type="table",
            title=f"Comparison: {a.period_label} vs {b.period_label}",
            data=[
                {"Metric": "CSAT Score",
                 a.period_label: f"{a.csat_score}%",
                 b.period_label: f"{b.csat_score}%",
                 "Change": f"{best_comp.delta_csat:+.1f}pp"},
                {"Metric": "Avg Rating",
                 a.period_label: f"{a.avg_rating:.2f}/5",
                 b.period_label: f"{b.avg_rating:.2f}/5",
                 "Change": f"{best_comp.delta_avg_rating:+.3f}"},
                {"Metric": "Responses",
                 a.period_label: f"{a.total_responses:,}",
                 b.period_label: f"{b.total_responses:,}",
                 "Change": f"{b.total_responses - a.total_responses:+,}"},
            ],
            x_key="Metric",
            y_keys=[a.period_label, b.period_label, "Change"],
            colors=[],
        )

    # ── BRANCH 5: single comparison ────────────────────────────────────────────
    best_comp = comparison_result
    if best_comp:
        a, b = best_comp.period_a, best_comp.period_b

        # Theme breakdown across both periods → grouped bar
        a_themes = {t.theme: t.percentage for t in a.top_themes}
        b_themes = {t.theme: t.percentage for t in b.top_themes}
        all_keys = list(dict.fromkeys(
            [t.theme for t in a.top_themes] + [t.theme for t in b.top_themes]
        ))[:6]

        theme_data = [
            {
                "theme": t.replace("_", " ").title(),
                a.period_label: round(a_themes.get(t, 0), 1),
                b.period_label: round(b_themes.get(t, 0), 1),
            }
            for t in all_keys
        ]

        # Default comparison table (always useful even when themes shown)
        return VizSpec(
            type="table",
            title=f"{a.period_label} vs {b.period_label}",
            data=[
                {"Metric": "CSAT Score",
                 a.period_label: f"{a.csat_score}%",
                 b.period_label: f"{b.csat_score}%",
                 "Change": f"{best_comp.delta_csat:+.1f}pp"},
                {"Metric": "Avg Rating",
                 a.period_label: f"{a.avg_rating:.2f}/5",
                 b.period_label: f"{b.avg_rating:.2f}/5",
                 "Change": f"{best_comp.delta_avg_rating:+.3f}"},
                {"Metric": "Responses",
                 a.period_label: f"{a.total_responses:,}",
                 b.period_label: f"{b.total_responses:,}",
                 "Change": f"{b.total_responses - a.total_responses:+,}"},
            ],
            x_key="Metric",
            y_keys=[a.period_label, b.period_label, "Change"],
            colors=[],
        )

    # ── BRANCH 6: single period ────────────────────────────────────────────────
    if data_result:
        # Pie chart when question explicitly requests it and rating_distribution is available
        question_lower = question.lower()
        if "pie" in question_lower and data_result.rating_distribution:
            dist = data_result.rating_distribution
            return VizSpec(
                type="pie",
                title=f"Rating Distribution — {data_result.period_label}",
                data=[
                    {"name": f"{star} Star", "value": dist.get(str(star), 0)}
                    for star in range(1, 6)
                    if dist.get(str(star), 0) > 0
                ],
                x_key="name",
                value_key="value",
                colors=RATING_COLORS,
            )

        # Themes bar (default for single-period queries)
        if data_result.top_themes:
            return VizSpec(
                type="bar",
                title=f"Top Themes — {data_result.period_label}",
                data=[
                    {
                        "theme": t.theme.replace("_", " ").title(),
                        "percentage": t.percentage,
                        "count": t.count,
                    }
                    for t in data_result.top_themes[:6]
                ],
                x_key="theme",
                value_key="percentage",
                unit="%",
                colors=THEME_COLORS,
            )

    # ── BRANCH 7: no numeric data ─────────────────────────────────────────────
    return None
