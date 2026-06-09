"""
agents/summary_agent.py
------------------------
SummaryAgent: Drafts the final coherent narrative answer.

Receives all aggregated structured data (DataAgentResult, ComparisonAgentResult,
RAGAgentResult) and synthesizes them into a business-language paragraph.

Uses the unified LLM abstraction (providers.llm.get_llm()) so it automatically
works with Groq, Gemini, OpenAI, or Anthropic based on Admin Center config.
Falls back to a deterministic template when no LLM is available.
"""

from __future__ import annotations

import json
import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from providers.llm import get_llm
from schemas.models import (
    ComparisonAgentResult,
    DataAgentResult,
    RAGAgentResult,
    SummaryAgentResult,
    TaskSpec,
)
from tools.viz_builder import build_visualization

load_dotenv()


def _format_comparison(comp: ComparisonAgentResult) -> str:
    """Format a single ComparisonAgentResult into a context block string."""
    a, b = comp.period_a, comp.period_b
    from datetime import date as _date
    a_start = _date.fromisoformat(a.date_range.start)
    b_start = _date.fromisoformat(b.date_range.start)
    if a_start <= b_start:
        baseline, current = a, b
        delta_csat = comp.delta_csat
        delta_rating = comp.delta_avg_rating
    else:
        baseline, current = b, a
        delta_csat = -comp.delta_csat
        delta_rating = -comp.delta_avg_rating
    direction = "IMPROVED" if delta_csat >= 0 else "DECLINED"
    return (
        f"BASELINE ({baseline.period_label}): CSAT={baseline.csat_score}%, "
        f"avg_rating={baseline.avg_rating:.2f}, responses={baseline.total_responses:,}\n"
        f"Top themes: {', '.join(t.theme for t in baseline.top_themes[:3])}\n"
        f"CURRENT ({current.period_label}): CSAT={current.csat_score}%, "
        f"avg_rating={current.avg_rating:.2f}, responses={current.total_responses:,}\n"
        f"Top themes: {', '.join(t.theme for t in current.top_themes[:3])}\n"
        f"CHANGE: CSAT {delta_csat:+.1f}pp ({direction}), avg_rating {delta_rating:+.3f}\n"
        f"Emerging: {comp.emerging_themes or 'none'} | "
        f"Declining: {comp.declining_themes or 'none'}\n"
        f"Analyst note: {comp.insight_summary}"
    )


def _deterministic_narrative(
    task: TaskSpec,
    data_result: DataAgentResult | None,
    rag_result: RAGAgentResult | None,
    effective_comparisons: list[ComparisonAgentResult],
) -> str:
    """Produce a structured narrative without an LLM."""
    parts = []
    if effective_comparisons:
        for comp in effective_comparisons:
            a, b = comp.period_a, comp.period_b
            parts.append(
                f"Comparison {a.period_label} vs {b.period_label}: "
                f"CSAT changed by {comp.delta_csat:+.1f}pp, "
                f"avg rating by {comp.delta_avg_rating:+.3f}. "
                f"{comp.insight_summary}"
            )
    elif data_result:
        parts.append(
            f"For {data_result.period_label}: CSAT={data_result.csat_score}%, "
            f"avg_rating={data_result.avg_rating:.2f}/5, "
            f"total responses={data_result.total_responses:,}. "
            f"Top themes: {', '.join(t.theme for t in data_result.top_themes[:3])}."
        )
    if rag_result:
        parts.append(f"Business context: {rag_result.context_summary}")
    if not parts:
        parts.append(f"Query: {task.intent}. No structured data available.")
    return " ".join(parts)


def run(
    task: TaskSpec,
    data_result: DataAgentResult | None = None,
    rag_result: RAGAgentResult | None = None,
    comparison_result: ComparisonAgentResult | None = None,
    all_comparison_results: list[ComparisonAgentResult] | None = None,
) -> SummaryAgentResult:
    """
    Generate the final narrative answer.

    Args:
        task: The original task spec (contains the user's question in intent)
        data_result: Optional DataAgentResult for single-period analysis
        rag_result: Optional RAGAgentResult for business context
        comparison_result: Optional ComparisonAgentResult (last one, fallback)
        all_comparison_results: All ComparisonAgentResults for compound queries
    """
    # ── Build context block for the prompt ───────────────────────────────────
    context_parts = []

    effective_comparisons: list[ComparisonAgentResult] = (
        all_comparison_results if all_comparison_results
        else ([comparison_result] if comparison_result else [])
    )

    if effective_comparisons:
        for idx, comp in enumerate(effective_comparisons, 1):
            header = f"## Period Comparison {idx}" if len(effective_comparisons) > 1 else "## Period Comparison"
            context_parts.append(f"{header}\n{_format_comparison(comp)}")
    elif data_result:
        context_parts.append(
            f"## Survey Metrics ({data_result.period_label})\n"
            f"Total responses: {data_result.total_responses:,}\n"
            f"CSAT: {data_result.csat_score}%\n"
            f"Average rating: {data_result.avg_rating:.2f}/5\n"
            f"Top themes: {', '.join(f'{t.theme} ({t.percentage:.1f}%)' for t in data_result.top_themes[:5])}\n"
            f"Rating distribution: {json.dumps(data_result.rating_distribution)}"
        )

    if rag_result:
        context_parts.append(
            f"## Business Context (from FAQ)\n{rag_result.context_summary}\n\n"
            f"Relevant FAQ excerpts:\n"
            + "\n".join(f"- {c.text[:200]}" for c in rag_result.retrieved_chunks)
        )

    context_block = "\n\n".join(context_parts) if context_parts else "No structured data available."

    # ── Try LLM narrative generation ─────────────────────────────────────────
    multi_q_instruction = (
        "The business question contains multiple sub-questions. "
        "Address each sub-question explicitly with its own finding. "
        "Use numbered findings if there are 3+ sub-questions.\n"
        if len(effective_comparisons) > 1
        else ""
    )
    prompt = (
        "You are a business intelligence analyst for GreenLeaf Bistro. "
        "Using the structured data below, answer the business question with a clear, "
        "concise narrative. "
        f"{multi_q_instruction}"
        "Requirements:\n"
        "- Lead with the most important insight\n"
        "- Include specific numbers (CSAT %, avg rating, response counts)\n"
        "- Reference the business context where relevant\n"
        "- End with a concrete, actionable recommendation\n"
        "- Write in business-professional tone\n"
        "- DO NOT apologize or state that you cannot create graphs or visualizations. The UI automatically renders charts. Focus ONLY on the narrative.\n"
        "- Keep the narrative concise (1-2 paragraphs max). Do not use bloated markdown headers like 'Executive Summary' or 'Detailed Analysis'.\n\n"
        f"**Business Question**: {task.context.get('original_question', task.intent)}\n\n"
        f"**Structured Data**:\n{context_block}"
    )

    narrative = ""
    try:
        llm = get_llm()
        if llm.available:
            resp = llm.chat(
                messages=[{"role": "user", "content": prompt}],
                tools=None,
            )
            narrative = resp.content.strip()
    except Exception as e:
        print(f"[SummaryAgent] LLM error: {e}")

    if not narrative:
        narrative = _deterministic_narrative(task, data_result, rag_result, effective_comparisons)

    # ── Build supporting_data summary ─────────────────────────────────────────
    key_metrics: dict = {}
    if data_result:
        key_metrics["csat"] = data_result.csat_score
        key_metrics["avg_rating"] = data_result.avg_rating
        key_metrics["total_responses"] = data_result.total_responses
    if comparison_result:
        key_metrics["delta_csat"] = comparison_result.delta_csat
        key_metrics["delta_avg_rating"] = comparison_result.delta_avg_rating
        key_metrics["emerging_themes"] = comparison_result.emerging_themes
        key_metrics["declining_themes"] = comparison_result.declining_themes

    # ── Build visualization spec ──────────────────────────────────────────────
    try:
        viz = build_visualization(
            question=task.context.get("original_question", task.intent),
            data_result=data_result,
            comparison_result=comparison_result or (
                all_comparison_results[-1] if all_comparison_results else None
            ),
            all_comparison_results=all_comparison_results,
        )
    except Exception as e:
        print(f"[SummaryAgent] viz_builder error (non-fatal): {e}")
        viz = None

    return SummaryAgentResult(narrative=narrative, key_metrics=key_metrics, visualization=viz)
