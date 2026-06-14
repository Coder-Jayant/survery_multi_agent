"""
agents/data_agent.py
---------------------
DataAgent: Computes exact survey metrics via tool calling.

This agent demonstrates Groq function-calling:
1. Receives a TaskSpec with date filters
2. Sends the tool definitions to the LLM along with a prompt
3. The LLM decides which tools to call and with what arguments
4. We execute those tool calls against the loaded dataset
5. Results are assembled into a typed DataAgentResult

The LLM is used for *orchestrating* the tool calls (deciding what to compute)
not for the computation itself — keeping metrics deterministic and accurate.
"""

from __future__ import annotations

import json
import os
import sys
from functools import lru_cache

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from providers.llm import get_llm
from schemas.models import DataAgentResult, DateRange, TaskSpec, ThemeCount
from tools.data_tools import (
    TOOL_DEFINITIONS,
    csat_by_segment,
    compare_themes,
    compute_avg_rating,
    compute_csat,
    count_responses,
    dispatch_tool,
    extract_top_themes,
    filter_by_period,
    rating_distribution,
    theme_csat_by_period,
    weekly_trend,
)

load_dotenv()

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "survey_responses.json")


@lru_cache(maxsize=1)
def _load_responses() -> tuple[dict, ...]:
    """Load and cache survey data. Returns a tuple (hashable for lru_cache)."""
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return tuple(data["responses"])


def run(task: TaskSpec, trace_callback=None) -> DataAgentResult:
    """
    Execute the DataAgent for a given TaskSpec.
    Uses Groq tool-calling to determine which metrics to compute.
    """
    llm = get_llm()
    client = llm._client
    model = llm.model

    filters = task.filters
    date_range = filters.get("date_range", {})

    responses = list(_load_responses())

    # Derive default date range from dataset bounds if not provided by orchestrator
    if not date_range:
        try:
            from calendar import monthrange as _mr
            import datetime as _dt
            dates = [r["date"] for r in responses if r.get("date")]
            _max = _dt.date.fromisoformat(max(dates))
            _start = _max.replace(day=1)
            _end = _max.replace(day=_mr(_max.year, _max.month)[1])
            start_date, end_date = str(_start), str(_end)
        except Exception:
            start_date, end_date = "2026-05-01", "2026-05-31"
    else:
        start_date = date_range.get("start", "2026-05-01")
        end_date   = date_range.get("end",   "2026-05-31")

    period_label = filters.get("period_label", f"{start_date} to {end_date}")



    # ── Step 1: Ask the LLM which tools to call ──────────────────────────────
    system_prompt = (
        "You are DataAgent, a precise survey analytics engine for GreenLeaf Bistro.\n"
        "Given a task and date range, call ONLY the tools needed to answer the specific request.\n"
        "Do not call tools that are irrelevant to the query.\n\n"
        "Available tools and when to use them:\n"
        "  - compute_csat                          → CSAT percentage, satisfaction score\n"
        "  - compute_avg_rating                    → average star rating\n"
        "  - rating_distribution                   → breakdown by star (1–5), pie chart\n"
        "  - extract_top_themes                    → top complaint/praise themes\n"
        "  - extract_top_themes(max_rating=1)      → themes for 1-star/lowest-rated responses\n"
        "  - extract_top_themes(min_rating=4)      → themes for satisfied/positive responses\n"
        "  - csat_by_segment(channel, theme)       → CSAT for a specific channel or theme slice\n"
        "  - weekly_trend(metric)                  → weekly trends, spikes, or patterns\n"
        "  - compare_themes(themes=[...])          → head-to-head CSAT between specific themes\n"
        "  - theme_csat_by_period                  → per-theme CSAT ranking (highest/lowest)\n\n"
        "Examples:\n"
        "  'What is CSAT in April?' → call compute_csat only\n"
        "  'Top complaints in May?' → call extract_top_themes only\n"
        "  'Compare food vs wait time?' → call compare_themes only\n"
        "  'Which week had worst ratings?' → call weekly_trend only\n"
        "  'Full summary of April metrics?' → call compute_csat, compute_avg_rating, extract_top_themes\n"
        "  'How do email complaints differ from web complaints?' → call csat_by_segment twice: once with channel='email', once with channel='web'\n"
        "  'CSAT for mobile users with staff complaints?' → call csat_by_segment with channel='mobile' AND theme='staff'\n\n"
        "IMPORTANT: csat_by_segment can be called multiple times with different arguments in the same response.\n"
        "Always use the provided date range. Be precise and minimal."
    )
    user_message = (
        f"Task: {task.intent}\n"
        f"Date range: {start_date} to {end_date}\n"
        f"Period label: {period_label}\n"
        "Call only the tools needed to answer this specific task."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_message},
    ]

    tool_trace = []
    # Tool call results we'll accumulate
    metric_results: dict = {}

    # ── Step 2: Agentic tool-calling loop ────────────────────────────────────
    # Wrapped in try/except: LLM may be unavailable (rate limit, wrong key,
    # provider switch) or generate malformed tool JSON. Step 3 fallback handles
    # all cases deterministically, so this is always safe.
    try:
        if client is None:
            raise RuntimeError("LLM client not available — falling back to deterministic mode")
        max_iterations = 6
        for _ in range(max_iterations):
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
            )

            message = response.choices[0].message

            if not message.tool_calls:
                break

            messages.append({"role": "assistant", "content": message.content or "", "tool_calls": [
                {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in message.tool_calls
            ]})

            for tool_call in message.tool_calls:
                fn_name = tool_call.function.name
                try:
                    fn_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    continue  # skip malformed tool call, fallback handles it

                tool_trace.append(f"→ {fn_name}({fn_args})")
                if trace_callback:
                    trace_callback({"type": "tool_call", "agent": "data_agent",
                                    "tool": fn_name, "args": fn_args})

                result = dispatch_tool(fn_name, fn_args, responses)

                # Use a list to accumulate multiple calls to the same tool
                # (e.g. csat_by_segment called twice for email and web channels)
                if fn_name in metric_results:
                    existing = metric_results[fn_name]
                    if isinstance(existing, list) and not isinstance(existing, dict):
                        existing.append(result)
                    else:
                        metric_results[fn_name] = [existing, result]
                else:
                    metric_results[fn_name] = result

                if trace_callback:
                    trace_callback({"type": "tool_result", "agent": "data_agent",
                                    "tool": fn_name, "result": str(result)[:120]})

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                })
    except Exception:
        # Groq API error (400 tool_use_failed, rate limit, etc.)
        # Step 3 fallback below will compute all metrics directly.
        pass

    # ── Step 3: Ensure we have all required metrics (fallback direct calls) ──
    # Any metric NOT already computed by the LLM loop is computed here directly.
    # We emit trace_callback events so the UI always shows tool calls, even in
    # deterministic mode (no LLM key, rate-limited, etc.).
    filtered = filter_by_period(responses, start_date, end_date)
    date_args = {"start_date": start_date, "end_date": end_date}

    def _fallback_call(fn_name, fn_args, result):
        """Emit trace events for a deterministic fallback tool call."""
        tool_trace.append(f"→ {fn_name}({fn_args}) [fallback]")
        if trace_callback:
            trace_callback({"type": "tool_call", "agent": "data_agent",
                            "tool": fn_name, "args": fn_args})
            trace_callback({"type": "tool_result", "agent": "data_agent",
                            "tool": fn_name, "result": str(result)[:120]})
        return result

    csat = metric_results.get("compute_csat")
    if csat is None:
        csat = _fallback_call("compute_csat", date_args, compute_csat(filtered))

    avg_rating = metric_results.get("compute_avg_rating")
    if avg_rating is None:
        avg_rating = _fallback_call("compute_avg_rating", date_args, compute_avg_rating(filtered))

    top_themes_raw = metric_results.get("extract_top_themes")
    if top_themes_raw is None:
        top_themes_raw = _fallback_call("extract_top_themes",
                                        {**date_args, "top_n": 5},
                                        extract_top_themes(filtered, 5))

    rating_dist = metric_results.get("rating_distribution")
    if rating_dist is None:
        rating_dist = _fallback_call("rating_distribution", date_args, rating_distribution(filtered))

    total = count_responses(filtered)

    # ── Step 4: Build typed result ────────────────────────────────────────────
    top_themes = [
        ThemeCount(
            theme=t["theme"],
            count=t["count"],
            percentage=t["percentage"],
        )
        for t in top_themes_raw
    ]

    return DataAgentResult(
        period_label=period_label,
        date_range=DateRange(start=start_date, end=end_date),
        total_responses=total,
        avg_rating=avg_rating,
        csat_score=csat,
        top_themes=top_themes,
        rating_distribution={str(k): v for k, v in rating_dist.items()},
        tool_trace=tool_trace,
        # Populate optional rich-data fields if those tools were called
        weekly_data=metric_results.get("weekly_trend"),
        segment_data=metric_results.get("csat_by_segment"),
        theme_comparison_data=metric_results.get("compare_themes"),
        theme_csat_data=metric_results.get("theme_csat_by_period"),
    )
