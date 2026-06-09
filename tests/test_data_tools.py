"""
tests/test_data_tools.py
Tests for all deterministic tool functions in tools/data_tools.py
"""

import pytest
from tools.data_tools import (
    filter_by_period,
    compute_csat,
    compute_avg_rating,
    rating_distribution,
    extract_top_themes,
    count_responses,
    responses_by_channel,
    dispatch_tool,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────

SAMPLE_RESPONSES = [
    {"response_id": "r1", "date": "2026-04-05", "rating": 5, "free_text": "The food was amazing", "response_channel": "mobile"},
    {"response_id": "r2", "date": "2026-04-10", "rating": 4, "free_text": "Staff was very friendly and helpful", "response_channel": "web"},
    {"response_id": "r3", "date": "2026-04-20", "rating": 2, "free_text": "Wait time was too long, very slow", "response_channel": "kiosk"},
    {"response_id": "r4", "date": "2026-05-01", "rating": 1, "free_text": "Dirty tables, cleanliness issues", "response_channel": "mobile"},
    {"response_id": "r5", "date": "2026-05-15", "rating": 3, "free_text": "App crashed during payment", "response_channel": "web"},
    {"response_id": "r6", "date": "2026-05-25", "rating": 4, "free_text": "Good value for the price", "response_channel": "email"},
]


# ── filter_by_period ──────────────────────────────────────────────────────────

class TestFilterByPeriod:
    def test_april_only(self):
        result = filter_by_period(SAMPLE_RESPONSES, "2026-04-01", "2026-04-30")
        assert len(result) == 3
        assert all(r["date"].startswith("2026-04") for r in result)

    def test_may_only(self):
        result = filter_by_period(SAMPLE_RESPONSES, "2026-05-01", "2026-05-31")
        assert len(result) == 3

    def test_inclusive_bounds(self):
        result = filter_by_period(SAMPLE_RESPONSES, "2026-04-05", "2026-04-05")
        assert len(result) == 1
        assert result[0]["response_id"] == "r1"

    def test_empty_result(self):
        result = filter_by_period(SAMPLE_RESPONSES, "2026-01-01", "2026-01-31")
        assert result == []

    def test_full_range(self):
        result = filter_by_period(SAMPLE_RESPONSES, "2026-04-01", "2026-05-31")
        assert len(result) == 6


# ── compute_csat ──────────────────────────────────────────────────────────────

class TestComputeCsat:
    def test_all_satisfied(self):
        responses = [{"rating": 4}, {"rating": 5}, {"rating": 4}]
        assert compute_csat(responses) == 100.0

    def test_none_satisfied(self):
        responses = [{"rating": 1}, {"rating": 2}, {"rating": 3}]
        assert compute_csat(responses) == 0.0

    def test_mixed(self):
        responses = [{"rating": 5}, {"rating": 2}, {"rating": 4}, {"rating": 1}]
        assert compute_csat(responses) == 50.0

    def test_empty(self):
        assert compute_csat([]) == 0.0

    def test_sample_april(self):
        april = filter_by_period(SAMPLE_RESPONSES, "2026-04-01", "2026-04-30")
        # r1=5, r2=4, r3=2 → 2/3 satisfied = 66.67%
        assert compute_csat(april) == pytest.approx(66.67, abs=0.01)


# ── compute_avg_rating ────────────────────────────────────────────────────────

class TestComputeAvgRating:
    def test_all_five(self):
        assert compute_avg_rating([{"rating": 5}, {"rating": 5}]) == 5.0

    def test_mixed(self):
        responses = [{"rating": 1}, {"rating": 2}, {"rating": 3}, {"rating": 4}, {"rating": 5}]
        assert compute_avg_rating(responses) == 3.0

    def test_empty(self):
        assert compute_avg_rating([]) == 0.0

    def test_sample_responses(self):
        # 5+4+2+1+3+4 = 19 / 6 = 3.167
        avg = compute_avg_rating(SAMPLE_RESPONSES)
        assert avg == pytest.approx(3.167, abs=0.001)


# ── rating_distribution ───────────────────────────────────────────────────────

class TestRatingDistribution:
    def test_structure(self):
        dist = rating_distribution(SAMPLE_RESPONSES)
        assert set(dist.keys()) == {"1", "2", "3", "4", "5"}

    def test_counts(self):
        dist = rating_distribution(SAMPLE_RESPONSES)
        assert dist["5"] == 1
        assert dist["4"] == 2
        assert dist["3"] == 1
        assert dist["2"] == 1
        assert dist["1"] == 1

    def test_empty(self):
        dist = rating_distribution([])
        assert sum(dist.values()) == 0


# ── extract_top_themes ────────────────────────────────────────────────────────

class TestExtractTopThemes:
    def test_returns_list_of_dicts(self):
        themes = extract_top_themes(SAMPLE_RESPONSES)
        assert isinstance(themes, list)
        for t in themes:
            assert "theme" in t
            assert "count" in t
            assert "percentage" in t

    def test_top_n_limit(self):
        themes = extract_top_themes(SAMPLE_RESPONSES, n=2)
        assert len(themes) <= 2

    def test_food_quality_detected(self):
        r = [{"free_text": "The food was amazing and fresh"}]
        themes = extract_top_themes(r, n=5)
        theme_names = [t["theme"] for t in themes]
        assert "food_quality" in theme_names

    def test_wait_time_detected(self):
        r = [{"free_text": "The wait time was too long and queue was huge"}]
        themes = extract_top_themes(r, n=5)
        theme_names = [t["theme"] for t in themes]
        assert "wait_time" in theme_names

    def test_general_fallback(self):
        r = [{"free_text": "xyz123 no keywords here"}]
        themes = extract_top_themes(r, n=5)
        assert themes[0]["theme"] == "general"

    def test_empty(self):
        assert extract_top_themes([]) == []


# ── count_responses ───────────────────────────────────────────────────────────

class TestCountResponses:
    def test_count(self):
        assert count_responses(SAMPLE_RESPONSES) == 6

    def test_empty(self):
        assert count_responses([]) == 0


# ── responses_by_channel ──────────────────────────────────────────────────────

class TestResponsesByChannel:
    def test_channels(self):
        result = responses_by_channel(SAMPLE_RESPONSES)
        assert result["mobile"] == 2
        assert result["web"] == 2
        assert result["kiosk"] == 1
        assert result["email"] == 1

    def test_empty(self):
        assert responses_by_channel([]) == {}


# ── dispatch_tool ─────────────────────────────────────────────────────────────

class TestDispatchTool:
    def test_compute_csat_dispatch(self):
        result = dispatch_tool("compute_csat", {"start_date": "2026-04-01", "end_date": "2026-04-30"}, SAMPLE_RESPONSES)
        assert isinstance(result, float)
        assert 0 <= result <= 100

    def test_compute_avg_rating_dispatch(self):
        result = dispatch_tool("compute_avg_rating", {"start_date": "2026-04-01", "end_date": "2026-04-30"}, SAMPLE_RESPONSES)
        assert isinstance(result, float)

    def test_extract_top_themes_dispatch(self):
        result = dispatch_tool("extract_top_themes", {"start_date": "2026-04-01", "end_date": "2026-04-30"}, SAMPLE_RESPONSES)
        assert isinstance(result, list)

    def test_rating_distribution_dispatch(self):
        result = dispatch_tool("rating_distribution", {"start_date": "2026-04-01", "end_date": "2026-05-31"}, SAMPLE_RESPONSES)
        assert isinstance(result, dict)

    def test_unknown_tool_raises(self):
        with pytest.raises(ValueError, match="Unknown tool"):
            dispatch_tool("nonexistent_tool", {}, SAMPLE_RESPONSES)
