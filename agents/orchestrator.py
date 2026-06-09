"""
agents/orchestrator.py
-----------------------
OrchestratorAgent (Planner): The brain of the MiniSense system.

Responsibilities:
1. Receive a natural language business question
2. Use LLM function-calling to decompose it into a structured plan (list of TaskSpecs)
3. Route each TaskSpec to the correct sub-agent
4. Collect all typed sub-agent results
5. Pass everything to SummaryAgent for final narrative synthesis
6. Return a FinalAnswer

Key design principle: The orchestrator NEVER passes raw text between agents.
It always uses TaskSpec (in) and *AgentResult (out).

Fallback: if no LLM is available (missing API key), _deterministic_plan() uses
keyword heuristics to build a sensible plan — the system never crashes.
Credit: fallback planner design inspired by the Lovable minisense architecture.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from typing import Any

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from schemas.models import (
    ComparisonAgentResult,
    DataAgentResult,
    FinalAnswer,
    RAGAgentResult,
    SummaryAgentResult,
    TaskSpec,
)
from providers.llm import get_llm, LLMResponse
import agents.data_agent as data_agent
import agents.rag_agent as rag_agent
import agents.comparison_agent as comparison_agent
import agents.summary_agent as summary_agent

load_dotenv()

# ──────────────────────────────────────────────────────────────────────────────
# Planning tool: the LLM calls this to create the agent execution plan
# ──────────────────────────────────────────────────────────────────────────────

PLANNING_TOOL = [
    {
        "type": "function",
        "function": {
            "name": "create_execution_plan",
            "description": (
                "Create a structured execution plan as a list of sub-tasks, "
                "each routed to a specific agent. Call this once to plan all steps."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "description": "Ordered list of sub-tasks to execute",
                        "items": {
                            "type": "object",
                            "properties": {
                                "agent": {
                                    "type": "string",
                                    "enum": ["data_agent", "rag_agent", "comparison_agent", "summary_agent"],
                                    "description": "Which agent handles this task",
                                },
                                "intent": {
                                    "type": "string",
                                    "description": "What this sub-task should do (1 sentence)",
                                },
                                "filters": {
                                    "type": "object",
                                    "description": (
                                        "Filters for the agent. For data_agent: include date_range {start, end} and period_label. "
                                        "For rag_agent: intent becomes the retrieval query. "
                                        "For comparison_agent: include period_a {start,end}, period_b {start,end}, label_a, label_b. "
                                        "For summary_agent: leave empty."
                                    ),
                                },
                            },
                            "required": ["agent", "intent", "filters"],
                        },
                    },
                },
                "required": ["tasks"],
            },
        },
    }
]


def _deterministic_plan(question: str) -> list[dict]:
    """
    Keyword-based fallback planner — runs without any LLM.
    Guarantees the system never crashes due to missing API key.
    """
    q = question.lower()
    needs_compare = any(w in q for w in [
        "compare", "vs", "versus", "month over month", "last month",
        "previous month", "between", "change", "trend", "differ"
    ])
    tasks = []
    if needs_compare:
        tasks.append({
            "agent": "comparison_agent",
            "intent": "Month-over-month comparison April vs May 2026",
            "filters": {
                "period_a": {"start": "2026-04-01", "end": "2026-04-30"},
                "period_b": {"start": "2026-05-01", "end": "2026-05-31"},
                "label_a": "April 2026",
                "label_b": "May 2026",
            },
        })
    else:
        tasks.append({
            "agent": "data_agent",
            "intent": "Compute survey metrics for May 2026",
            "filters": {
                "date_range": {"start": "2026-05-01", "end": "2026-05-31"},
                "period_label": "May 2026",
            },
        })
    tasks.append({
        "agent": "rag_agent",
        "intent": question,
        "filters": {},
    })
    return tasks


def _plan(question: str) -> list[dict]:
    """
    Ask the LLM to decompose the question into an ordered list of sub-tasks.
    Falls back to _deterministic_plan() if LLM is unavailable or fails.
    """
    llm = get_llm()
    if not llm.available:
        print("[orchestrator] LLM unavailable — using deterministic planner")
        return _deterministic_plan(question)

    today = "2026-06-08"
    system_prompt = (
        "You are the Orchestrator for MiniSense, a survey analytics system for GreenLeaf Bistro. "
        "Available agents:\n"
        "- data_agent: computes exact metrics (CSAT, avg rating, themes) for a date period\n"
        "- rag_agent: retrieves relevant FAQ/policy context for a query\n"
        "- comparison_agent: compares two time periods (e.g., April vs May)\n"
        "- summary_agent: synthesizes all data into a final narrative (always last)\n\n"
        "Survey data covers: April 2026 (2026-04-01 to 2026-04-30) and May 2026 (2026-05-01 to 2026-05-31).\n"
        "Today's date: " + today + "\n\n"
        "Rules:\n"
        "1. Always include rag_agent to add business context\n"
        "2. Use comparison_agent when the question asks about changes, trends, or two periods\n"
        "3. Use data_agent when asking about a single period's metrics\n"
        "4. Do NOT include summary_agent in the tasks list — it is added automatically\n"
        "Call create_execution_plan with an ordered task list."
    )

    resp: LLMResponse = llm.chat(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        tools=PLANNING_TOOL,
        tool_choice={"type": "function", "function": {"name": "create_execution_plan"}},
    )

    if not resp.tool_calls:
        print("[orchestrator] LLM plan failed — using deterministic fallback")
        return _deterministic_plan(question)

    try:
        plan_data = resp.tool_calls[0]["arguments"]
        return plan_data["tasks"]
    except Exception as e:
        print(f"[orchestrator] Plan parse error ({e}) — using deterministic fallback")
        return _deterministic_plan(question)


def _route(task: TaskSpec, trace_callback=None, period_cache: dict | None = None):
    """Route a TaskSpec to the correct sub-agent and return its typed result.

    period_cache: dict mapping (start, end) → DataAgentResult for within-run deduplication.
    """
    if task.agent == "data_agent":
        # Check cache before re-running
        if period_cache is not None:
            dr = task.filters.get("date_range", {})
            cache_key = (dr.get("start", ""), dr.get("end", ""))
            if cache_key in period_cache:
                if trace_callback:
                    trace_callback({"type": "tool_call", "agent": "data_agent",
                                    "tool": "[cache_hit]", "args": {"period": task.filters.get("period_label", "")}})
                return period_cache[cache_key]
        result = data_agent.run(task, trace_callback=trace_callback)
        if period_cache is not None:
            dr = task.filters.get("date_range", {})
            cache_key = (dr.get("start", ""), dr.get("end", ""))
            period_cache[cache_key] = result
        return result

    elif task.agent == "rag_agent":
        return rag_agent.run(task)

    elif task.agent == "comparison_agent":
        # Pass cached DataAgent results to avoid re-computation
        filters = task.filters
        cached_a, cached_b = None, None
        if period_cache is not None:
            pa = filters.get("period_a", {})
            pb = filters.get("period_b", {})
            cached_a = period_cache.get((pa.get("start", ""), pa.get("end", "")))
            cached_b = period_cache.get((pb.get("start", ""), pb.get("end", "")))
        return comparison_agent.run(task, cached_result_a=cached_a, cached_result_b=cached_b)

    elif task.agent == "summary_agent":
        return None
    else:
        raise ValueError(f"Unknown agent: {task.agent}")


def ask(question: str, verbose: bool = False, trace_callback=None) -> FinalAnswer:
    """
    Main entry point: answer a natural language business question.

    Args:
        question:        The business question in natural language
        verbose:         If True, print agent trace to stdout
        trace_callback:  Optional callable(event_dict) for real-time SSE streaming

    Returns:
        FinalAnswer with narrative, supporting data, and agent trace
    """
    def emit(event: dict):
        if trace_callback:
            trace_callback(event)

    run_id = str(uuid.uuid4())[:8]

    if verbose:
        print(f"\n{'='*60}")
        print(f"Orchestrator: Planning execution for question:")
        print(f"   \"{question}\"")
        print(f"{'='*60}")

    # ── Step 1: Generate execution plan ──────────────────────────────────────
    raw_tasks = _plan(question)
    emit({"type": "plan", "tasks": [
        {"agent": t["agent"], "intent": t["intent"]} for t in raw_tasks
    ], "count": len(raw_tasks)})

    agent_trace = []
    # Accumulate ALL results (compound queries may produce multiple comparisons/RAG results)
    all_data_results: list[DataAgentResult] = []
    all_rag_results: list[RAGAgentResult] = []
    all_comparison_results: list[ComparisonAgentResult] = []
    # Period cache: (start, end) → DataAgentResult to avoid re-computation within same run
    period_cache: dict[tuple[str, str], DataAgentResult] = {}

    # ── Step 2: Execute each sub-task ─────────────────────────────────────────
    for i, raw_task in enumerate(raw_tasks):
        task = TaskSpec(
            task_id=f"{run_id}_task_{i}",
            agent=raw_task["agent"],
            intent=raw_task["intent"],
            filters=raw_task.get("filters", {}),
            context={"original_question": question},
        )

        if verbose:
            print(f"\n▶ [{i+1}/{len(raw_tasks)}] Running {task.agent}...")
            print(f"   Intent: {task.intent}")

        emit({"type": "agent_start", "step": i + 1, "total": len(raw_tasks) + 1,
              "agent": task.agent, "intent": task.intent})

        result = _route(task, trace_callback=trace_callback, period_cache=period_cache)
        agent_trace.append(task.agent)

        if isinstance(result, DataAgentResult):
            all_data_results.append(result)
            emit({"type": "agent_done", "agent": "data_agent", "step": i + 1,
                  "result": {"csat": result.csat_score, "avg_rating": result.avg_rating,
                             "responses": result.total_responses, "period": result.period_label,
                             "themes": [t.theme for t in result.top_themes[:3]]}})
            if verbose:
                print(f"   ✓ CSAT={result.csat_score}%, avg_rating={result.avg_rating}, "
                      f"responses={result.total_responses:,}")

        elif isinstance(result, RAGAgentResult):
            all_rag_results.append(result)
            emit({"type": "agent_done", "agent": "rag_agent", "step": i + 1,
                  "result": {"chunks": [{"id": c.chunk_id, "score": round(c.score, 3),
                                         "preview": c.text[:80]} for c in result.retrieved_chunks]}})
            if verbose:
                print(f"   ✓ Retrieved {len(result.retrieved_chunks)} chunks")

        elif isinstance(result, ComparisonAgentResult):
            all_comparison_results.append(result)
            emit({"type": "agent_done", "agent": "comparison_agent", "step": i + 1,
                  "result": {"delta_csat": result.delta_csat,
                             "delta_avg_rating": result.delta_avg_rating,
                             "emerging": result.emerging_themes,
                             "declining": result.declining_themes}})
            if verbose:
                print(f"   ✓ CSAT delta={result.delta_csat:+.1f}pp, "
                      f"avg_rating delta={result.delta_avg_rating:+.3f}")

    # ── Step 3: Synthesize with SummaryAgent ──────────────────────────────────
    if verbose:
        print(f"\n▶ [{len(raw_tasks)+1}/{len(raw_tasks)+1}] Running summary_agent...")

    emit({"type": "agent_start", "step": len(raw_tasks) + 1, "total": len(raw_tasks) + 1,
          "agent": "summary_agent", "intent": "Synthesize all results into a business narrative"})

    summary_task = TaskSpec(
        task_id=f"{run_id}_summary",
        agent="summary_agent",
        intent="Synthesize all results into a final business-language narrative",
        filters={},
        context={"original_question": question},
    )

    # Pass the most relevant result of each type (last data, last rag, last comparison)
    # For compound queries, SummaryAgent receives all comparisons via the comparison_results list
    summary_result: SummaryAgentResult = summary_agent.run(
        task=summary_task,
        data_result=all_data_results[-1] if all_data_results else None,
        rag_result=all_rag_results[-1] if all_rag_results else None,
        comparison_result=all_comparison_results[-1] if all_comparison_results else None,
        all_comparison_results=all_comparison_results if len(all_comparison_results) > 1 else None,
    )
    agent_trace.append("summary_agent")

    if verbose:
        print(f"   ✓ Narrative generated ({len(summary_result.narrative)} chars)")

    # ── Step 4: Build and return FinalAnswer ──────────────────────────────────
    sources = []
    if all_rag_results:
        for rag in all_rag_results:
            sources.extend(c.source for c in rag.retrieved_chunks)

    final = FinalAnswer(
        question=question,
        narrative=summary_result.narrative,
        supporting_data=summary_result.key_metrics,
        sources=list(set(sources)),
        agent_trace=agent_trace,
    )
    emit({"type": "done", "answer": {
        "narrative": final.narrative,
        "metrics": final.supporting_data,
        "sources": final.sources,
        "trace": final.agent_trace,
    }})
    return final
