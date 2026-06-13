"""
Quick smoke test for the 3 new DataAgent tools.
Run from project root: python scripts/test_new_tools.py
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.data_tools import (
    filter_by_period, csat_by_segment, weekly_trend, compare_themes
)

DATA_PATH = os.path.join("data", "survey_responses.json")
with open(DATA_PATH, "r", encoding="utf-8") as f:
    responses = json.load(f)["responses"]

may = filter_by_period(responses, "2026-05-01", "2026-05-31")
apr = filter_by_period(responses, "2026-04-01", "2026-04-30")

print("=" * 60)
print("TEST 1: csat_by_segment — mobile users who complained about staff (May)")
seg = csat_by_segment(may, channel="mobile", theme="staff")
print(f"  count={seg['count']}, csat={seg['csat']}%, avg_rating={seg['avg_rating']}")
assert seg["count"] > 0, "Expected results"

print("\nTEST 2: csat_by_segment — kiosk users, 1-2 star ratings (May)")
seg2 = csat_by_segment(may, channel="kiosk", min_rating=1, max_rating=2)
print(f"  count={seg2['count']}, avg_rating={seg2['avg_rating']}")

print("\nTEST 3: weekly_trend — CSAT by week across April+May")
weeks = weekly_trend(responses, "2026-04-01", "2026-05-31", metric="csat")
print(f"  {len(weeks)} weeks found")
for w in weeks:
    print(f"    {w['week']}  ({w['start_date']} to {w['end_date']})  csat={w['value']}%  n={w['count']}")
assert len(weeks) >= 4, "Expected at least 4 weeks"

print("\nTEST 4: compare_themes — food_quality vs staff vs wait_time (May)")
rankings = compare_themes(may, ["food_quality", "staff", "wait_time"])
for r in rankings:
    print(f"  {r['theme']:15s}  count={r['count']:5d}  csat={r['csat']:5.1f}%  avg_rating={r['avg_rating']:.3f}")

print("\nTEST 5: compare_themes — all 6 themes (April baseline)")
all_themes = compare_themes(apr, ["food_quality", "wait_time", "staff", "cleanliness", "price", "app"])
for r in all_themes:
    print(f"  {r['theme']:15s}  csat={r['csat']:5.1f}%")

print("\n" + "=" * 60)
print("ALL TESTS PASSED")
