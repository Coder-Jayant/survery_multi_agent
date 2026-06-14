"""
schemas/models.py
-----------------
All Pydantic models for structured inter-agent communication.
The orchestrator always passes TaskSpec objects to sub-agents,
and sub-agents always return typed result objects — never raw strings.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Task Specification  (Orchestrator → Sub-Agent)
# ---------------------------------------------------------------------------

class DateRange(BaseModel):
    start: str = Field(..., description="ISO date string YYYY-MM-DD")
    end: str = Field(..., description="ISO date string YYYY-MM-DD")


class TaskSpec(BaseModel):
    task_id: str = Field(..., description="Unique identifier for this sub-task")
    agent: str = Field(..., description="Target agent name: data_agent | rag_agent | comparison_agent | summary_agent")
    intent: str = Field(..., description="Human-readable description of what this sub-task should do")
    filters: dict[str, Any] = Field(default_factory=dict, description="Filters: date_range, business_id, etc.")
    context: dict[str, Any] = Field(default_factory=dict, description="Extra hints or upstream results passed to this agent")


# ---------------------------------------------------------------------------
# Shared sub-types
# ---------------------------------------------------------------------------

class ThemeCount(BaseModel):
    theme: str
    count: int
    percentage: float


class RetrievedChunk(BaseModel):
    chunk_id: str
    text: str
    score: float                                     # primary score (reranker if available, else FAISS)
    source: str = "faq_document.txt"
    faiss_score: Optional[float] = None              # Stage 1 cosine similarity
    rerank_score: Optional[float] = None             # Stage 2 cross-encoder logit
    reranked: bool = False                           # whether reranking was applied


# ---------------------------------------------------------------------------
# Sub-Agent Results
# ---------------------------------------------------------------------------

class DataAgentResult(BaseModel):
    period_label: str = Field(..., description="Human-readable label e.g. 'May 2026'")
    date_range: DateRange
    total_responses: int
    avg_rating: float
    csat_score: float = Field(..., description="Percentage of responses with rating >= 4")
    top_themes: list[ThemeCount]
    rating_distribution: dict[str, int] = Field(..., description="Keys are '1'-'5'")
    tool_trace: list[str] = Field(default_factory=list, description="Log of tool calls made")
    # Optional rich data from new tools — populated only when those tools were called
    weekly_data: Optional[list[dict]] = Field(None, description="weekly_trend output: [{week, start_date, end_date, value, count, metric}]")
    segment_data: Optional[Union[dict, list[dict]]] = Field(None, description="csat_by_segment output: single {segment, count, csat, avg_rating} or list when called multiple times (e.g. email vs web)")
    theme_comparison_data: Optional[list[dict]] = Field(None, description="compare_themes output: [{theme, count, csat, avg_rating, percentage_of_total}]")
    theme_csat_data: Optional[list[dict]] = Field(None, description="theme_csat_by_period output: [{theme, count, csat, avg_rating, percentage_of_total}] sorted worst-first")


class RAGAgentResult(BaseModel):
    query: str
    retrieved_chunks: list[RetrievedChunk]
    context_summary: str = Field(..., description="Short summary of retrieved context, ≤3 sentences")


class ComparisonAgentResult(BaseModel):
    period_a: DataAgentResult
    period_b: DataAgentResult
    delta_csat: float = Field(..., description="period_b.csat_score - period_a.csat_score")
    delta_avg_rating: float
    emerging_themes: list[str] = Field(default_factory=list, description="Themes that grew significantly")
    declining_themes: list[str] = Field(default_factory=list, description="Themes that declined significantly")
    insight_summary: str = Field(..., description="1-2 sentence plain English delta summary")

# ---------------------------------------------------------------------------
# Visualization Spec  (attached to SummaryAgentResult → sent in done SSE event)
# ---------------------------------------------------------------------------

class VizSpec(BaseModel):
    """Recharts-ready visualization spec.

    type:
        bar          — single-series horizontal bar (themes, rating dist)
        grouped_bar  — multi-series vertical bar (period comparison)
        pie          — pie / donut chart
        table        — HTML table (metric comparison)
    """
    type: str = Field(..., description="bar | grouped_bar | pie | table")
    title: str
    data: list[dict] = Field(default_factory=list, description="Recharts-ready row array")
    x_key: Optional[str] = None           # category key (theme, metric, name)
    y_keys: Optional[list[str]] = None    # series keys for grouped_bar / table columns
    value_key: Optional[str] = None       # single value key for bar / pie
    colors: Optional[list[str]] = None
    unit: Optional[str] = None            # "%" | "/5" | "responses"



class SummaryAgentResult(BaseModel):
    narrative: str = Field(..., description="Final coherent business-language answer paragraph")
    key_metrics: dict[str, Any] = Field(default_factory=dict)
    visualization: Optional[VizSpec] = Field(None, description="Optional chart/table for the answer")


# ---------------------------------------------------------------------------
# Final orchestrator output
# ---------------------------------------------------------------------------

class FinalAnswer(BaseModel):
    question: str
    narrative: str
    supporting_data: dict[str, Any] = Field(default_factory=dict)
    sources: list[str] = Field(default_factory=list)
    agent_trace: list[str] = Field(default_factory=list, description="Which agents were invoked")
