"""
tools/viz_builder.py
--------------------
Rule-based visualization selector.

Inspects the question + available data to pick the best Recharts-ready
VizSpec — no LLM call, instant, deterministic, zero hallucination risk.

Decision priority:
  1. Explicit user keywords (pie / table / bar chart) → override chart type
  2. Comparison data present → grouped bar or theme comparison
  3. Single-period data → bar (themes) or bar (rating distribution)
  4. RAG-only result → None (narrative is the answer)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from schemas.models import DataAgentResult, ComparisonAgentResult, VizSpec

# Consistent palette matching the frontend UI
THEME_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6", "#ec4899"]
PERIOD_COLORS = ["#6366f1", "#22c55e"]
RATING_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"]  # 1→5 red→green


def build_visualization(
    question: str,
    data_result=None,
    comparison_result=None,
    all_comparison_results=None,
):
    """
    Return a VizSpec or None.

    Args:
        question:               Original user question (used for keyword detection)
        data_result:            DataAgentResult | None
        comparison_result:      Most recent ComparisonAgentResult | None
        all_comparison_results: list[ComparisonAgentResult] | None
    """
    try:
        from schemas.models import VizSpec
    except ImportError:
        return None

    q = question.lower()

    # ── Keyword signals ───────────────────────────────────────────────────────
    force_pie   = any(w in q for w in ["pie", "donut"])
    force_table = any(w in q for w in ["table", "tabulate", "list all", "show all"])
    force_bar   = any(w in q for w in ["bar chart", "bar graph", "histogram"])
    wants_themes = any(w in q for w in ["theme", "complaint", "issue", "topic", "area"])
    wants_rating = any(w in q for w in ["rating", "distribution", "star", "score breakdown"])
    wants_viz   = any(w in q for w in [
        "chart", "graph", "visual", "plot", "show", "draw",
        "breakdown", "compare", "comparison", "distribute",
    ])

    # ── Pick best comparison ──────────────────────────────────────────────────
    best_comp = None
    if all_comparison_results:
        best_comp = all_comparison_results[-1]
    elif comparison_result:
        best_comp = comparison_result

    # ── BRANCH 1: Comparison data available ──────────────────────────────────
    if best_comp:
        a, b = best_comp.period_a, best_comp.period_b

        # Force table
        if force_table:
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

        # Theme question → grouped bar of theme percentages
        if wants_themes or force_pie or force_bar:
            a_themes = {t.theme: t.percentage for t in a.top_themes}
            b_themes = {t.theme: t.percentage for t in b.top_themes}
            all_theme_keys = list(dict.fromkeys(
                [t.theme for t in a.top_themes] + [t.theme for t in b.top_themes]
            ))[:6]

            if force_pie:
                # Pie of most recent period
                return VizSpec(
                    type="pie",
                    title=f"Theme Distribution — {b.period_label}",
                    data=[{"name": t.replace("_", " ").title(),
                           "value": round(b_themes.get(t, 0), 1)}
                          for t in all_theme_keys],
                    x_key="name",
                    value_key="value",
                    unit="%",
                    colors=THEME_COLORS,
                )

            return VizSpec(
                type="grouped_bar",
                title=f"Theme Comparison: {a.period_label} vs {b.period_label}",
                data=[
                    {
                        "theme": t.replace("_", " ").title(),
                        a.period_label: round(a_themes.get(t, 0), 1),
                        b.period_label: round(b_themes.get(t, 0), 1),
                    }
                    for t in all_theme_keys
                ],
                x_key="theme",
                y_keys=[a.period_label, b.period_label],
                unit="%",
                colors=PERIOD_COLORS,
            )

        # Default comparison → grouped bar of CSAT & avg_rating
        return VizSpec(
            type="grouped_bar",
            title=f"{a.period_label} vs {b.period_label}",
            data=[
                {
                    "metric": "CSAT (%)",
                    a.period_label: a.csat_score,
                    b.period_label: b.csat_score,
                },
                {
                    "metric": "Avg Rating (/5)",
                    a.period_label: round(a.avg_rating, 2),
                    b.period_label: round(b.avg_rating, 2),
                },
            ],
            x_key="metric",
            y_keys=[a.period_label, b.period_label],
            unit="",
            colors=PERIOD_COLORS,
        )

    # ── BRANCH 2: Single-period data ──────────────────────────────────────────
    if data_result:
        # Rating distribution
        if wants_rating:
            dist = data_result.rating_distribution
            if force_pie:
                return VizSpec(
                    type="pie",
                    title=f"Rating Distribution — {data_result.period_label}",
                    data=[{"name": f"{k}★", "value": v}
                          for k, v in sorted(dist.items())],
                    x_key="name",
                    value_key="value",
                    unit="responses",
                    colors=RATING_COLORS,
                )
            return VizSpec(
                type="bar",
                title=f"Rating Distribution — {data_result.period_label}",
                data=[{"rating": f"{k}★", "count": v}
                      for k, v in sorted(dist.items())],
                x_key="rating",
                value_key="count",
                unit="responses",
                colors=RATING_COLORS,
            )

        # Themes (auto or explicit)
        if wants_themes or wants_viz or force_pie or force_bar:
            theme_data = [
                {
                    "theme": t.theme.replace("_", " ").title(),
                    "percentage": t.percentage,
                    "count": t.count,
                }
                for t in data_result.top_themes[:6]
            ]

            if force_pie:
                return VizSpec(
                    type="pie",
                    title=f"Theme Distribution — {data_result.period_label}",
                    data=[{"name": d["theme"], "value": d["percentage"]}
                          for d in theme_data],
                    x_key="name",
                    value_key="value",
                    unit="%",
                    colors=THEME_COLORS,
                )

            if force_table:
                return VizSpec(
                    type="table",
                    title=f"Top Themes — {data_result.period_label}",
                    data=[{"Theme": d["theme"], "Count": d["count"],
                           "Share": f"{d['percentage']}%"}
                          for d in theme_data],
                    x_key="Theme",
                    y_keys=["Count", "Share"],
                    colors=[],
                )

            # Default: horizontal bar
            return VizSpec(
                type="bar",
                title=f"Top Themes — {data_result.period_label}",
                data=theme_data,
                x_key="theme",
                value_key="percentage",
                unit="%",
                colors=THEME_COLORS,
            )

    # ── BRANCH 3: No numeric data → no chart ─────────────────────────────────
    return None
