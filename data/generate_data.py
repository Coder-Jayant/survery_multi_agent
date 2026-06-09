"""
data/generate_data.py
---------------------
Generates ~195,000 realistic survey responses for GreenLeaf Bistro
spanning January–May 2026.

Narrative arc (designed to tell a story):
  Jan 2026: Strong start — CSAT ~72%. Loyal post-holiday crowd.
  Feb 2026: Slight dip — CSAT ~68%. Cold weather, Valentine's rush causes wait issues.
  Mar 2026: Recovery — CSAT ~74%. Spring menu launch, staff retraining.
  Apr 2026: Early warning — CSAT ~59%. New mobile app update has subtle bugs.
  May 2026: Crisis — CSAT ~39%. App crashes cascade, online reviews spread.

Design decisions:
  - Single business (GreenLeaf Bistro) to match FAQ
  - 6 themes: food_quality, wait_time, staff, cleanliness, price, app
  - Theme prevalence shifts month-by-month to match the narrative
  - Response volume grows realistically (word of mouth, more digital orders)
  - Channel mix shifts (app share grows each month as digital expands)
  - Rating distribution carefully tuned per month via sentiment_weights
  - App theme intentionally dominates Apr & May (the "crisis" signal)

Run:
    python data/generate_data.py
"""

import json
import random
import os
from datetime import date, timedelta
from tqdm import tqdm

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "survey_responses.json")

BUSINESS_ID = "b01"
BUSINESS_NAME = "GreenLeaf Bistro"

SURVEYS = [
    {"survey_id": "s01", "survey_name": "Overall Experience"},
    {"survey_id": "s02", "survey_name": "Food Quality"},
    {"survey_id": "s03", "survey_name": "Service Speed"},
    {"survey_id": "s04", "survey_name": "App & Digital Experience"},
]

# ── Month configurations ──────────────────────────────────────────────────────
# Each month has: date range, record count, sentiment_weights, theme_weights
# sentiment_weights = [positive, negative, neutral]
# theme_weights control which themes appear most in that month's free text

MONTH_CONFIGS = {
    "january": {
        "start": date(2026, 1, 1),
        "end": date(2026, 1, 31),
        "count": 32_000,
        # Jan: strong CSAT ~72%. New year, loyal regulars, staff well-rested.
        "sentiment_weights": [0.62, 0.22, 0.16],
        # Theme prevalence: food/staff drive positive, app barely on radar
        "theme_weights": {
            "food_quality": 0.28,
            "wait_time":    0.18,
            "staff":        0.22,
            "cleanliness":  0.12,
            "price":        0.12,
            "app":          0.08,  # app barely used yet
        },
        "channel_weights": [0.30, 0.35, 0.20, 0.15],  # mobile, web, kiosk, email
    },
    "february": {
        "start": date(2026, 2, 1),
        "end": date(2026, 2, 28),
        "count": 28_000,
        # Feb: CSAT ~68%. Valentine's rush causes wait time complaints. Quieter month overall.
        "sentiment_weights": [0.55, 0.30, 0.15],
        "theme_weights": {
            "food_quality": 0.22,
            "wait_time":    0.26,  # Valentine's queues
            "staff":        0.20,
            "cleanliness":  0.11,
            "price":        0.13,  # Valentine's specials feel overpriced
            "app":          0.08,
        },
        "channel_weights": [0.33, 0.32, 0.20, 0.15],
    },
    "march": {
        "start": date(2026, 3, 1),
        "end": date(2026, 3, 31),
        "count": 35_000,
        # Mar: best month. CSAT ~74%. Spring menu + staff retraining + GreenLeaf Rewards v2 launch.
        "sentiment_weights": [0.65, 0.20, 0.15],
        "theme_weights": {
            "food_quality": 0.30,  # spring menu hype
            "wait_time":    0.15,
            "staff":        0.24,  # retraining showing results
            "cleanliness":  0.12,
            "price":        0.09,
            "app":          0.10,  # Rewards v2 drives app adoption
        },
        "channel_weights": [0.38, 0.30, 0.18, 0.14],
    },
    "april": {
        "start": date(2026, 4, 1),
        "end": date(2026, 4, 30),
        "count": 40_000,
        # Apr: CSAT ~59%. New mobile app update deployed mid-April has latency bugs.
        # App usage is up (more digital orders) but satisfaction drops sharply.
        "sentiment_weights": [0.44, 0.40, 0.16],
        "theme_weights": {
            "food_quality": 0.20,
            "wait_time":    0.20,  # app delays cause wait time perception issues too
            "staff":        0.16,
            "cleanliness":  0.08,
            "price":        0.12,
            "app":          0.24,  # app complaints emerge significantly
        },
        "channel_weights": [0.42, 0.28, 0.16, 0.14],
    },
    "may": {
        "start": date(2026, 5, 1),
        "end": date(2026, 5, 31),
        "count": 60_000,
        # May: CSAT ~39%. App crashes go viral, wait times explode, online complaints surge.
        # Volume surges as angry customers submit multiple feedback forms.
        "sentiment_weights": [0.28, 0.57, 0.15],
        "theme_weights": {
            "food_quality": 0.17,
            "wait_time":    0.22,  # app delays → longer perceived waits
            "staff":        0.14,  # staff fielding more complaints, patience wears thin
            "cleanliness":  0.07,
            "price":        0.04,
            "app":          0.36,  # app is the main crisis driver
        },
        "channel_weights": [0.48, 0.28, 0.12, 0.12],  # more mobile submissions
    },
}

# ── Free-text templates ───────────────────────────────────────────────────────

FREE_TEXT_TEMPLATES = {
    "food_quality": {
        "positive": [
            "The food was absolutely delicious — fresh ingredients and great flavors.",
            "Loved the Garden Bowl. Perfectly balanced and very filling.",
            "The Avocado Toast was outstanding as always. Quality is consistently great.",
            "Fresh, healthy, and tasty. The seasonal special was a highlight this week.",
            "Great food quality. The ingredients taste locally sourced.",
            "The Mango Chili Wrap was phenomenal. Best thing I've had here.",
            "Everything was hot, fresh, and well presented. Impressed as always.",
            "Spring menu is excellent. The new Quinoa Power Bowl is a favourite.",
            "Flavors were vibrant and the portion size was generous. Very happy.",
            "Consistently high quality. This is why I keep coming back every week.",
        ],
        "negative": [
            "The food quality has really dropped lately. My Garden Bowl was lukewarm.",
            "The Avocado Toast was soggy and the portion size was noticeably smaller.",
            "Disappointed with the food today — the quinoa tasted stale.",
            "Order came out cold and the presentation was sloppy. Not what I expect here.",
            "The Cold Brew tasted watered down. Not up to their usual standard.",
            "My meal was undercooked. Had to send it back which added to my wait time.",
            "The seasonal bowl had clearly been sitting too long before it reached me.",
            "Ingredients didn't taste fresh today. This is a health café — that matters.",
            "My wrap was barely warm and the ingredients seemed pre-packaged.",
        ],
        "neutral": [
            "Food was okay, nothing special today but not bad either.",
            "The meal was decent. I've had better visits but it was fine.",
            "Food was acceptable. Portion sizes were a bit inconsistent.",
            "Average experience with the food. Would have expected better at this price.",
        ],
    },
    "wait_time": {
        "positive": [
            "My pre-order through the app was ready in under 5 minutes. Impressive!",
            "Quick service even during the lunch rush. Really appreciated it.",
            "Surprisingly fast for a Saturday afternoon. Out in under 10 minutes.",
            "Staff were efficient and my order was ready well ahead of estimate.",
            "Super fast pickup — in and out in 7 minutes. Perfect for a work lunch.",
        ],
        "negative": [
            "The wait time was unacceptable. Stood at the counter for 25 minutes.",
            "Waited over 20 minutes during off-peak hours. Completely unacceptable.",
            "The queue was enormous and the counter was understaffed. I nearly walked out.",
            "My pre-order wasn't ready on time. The app said 8 minutes; I waited 22.",
            "Way too slow during lunch. Lost 30 minutes of my break just waiting.",
            "Waited forever. This is supposed to be a quick lunch stop, not a sit-down restaurant.",
            "The queue moved incredibly slowly. One staff member was handling everything.",
            "Even for a Friday afternoon this wait was excessive. Over 18 minutes.",
            "My order was missing from the pre-order queue, adding another 12 minute delay.",
        ],
        "neutral": [
            "Wait time was within expectations for the lunch rush.",
            "Service speed was average. Nothing exceptional but acceptable for the time.",
            "Expected a longer wait but it was manageable.",
        ],
    },
    "staff": {
        "positive": [
            "The staff were incredibly friendly and helpful. Made my day!",
            "Excellent customer service. The barista remembered my regular order.",
            "Staff handled a mix-up with my order gracefully and with a smile.",
            "Very attentive and knowledgeable team. They answered all my allergy questions.",
            "Shout out to the morning crew — always warm and welcoming.",
            "The manager stepped in and resolved my issue immediately. Great leadership.",
            "Staff member proactively offered a solution before I even raised the issue.",
            "Team seemed genuinely happy and it showed in the service quality.",
        ],
        "negative": [
            "The staff seemed disinterested and barely acknowledged me.",
            "Rude service at the counter. My complaint was dismissed without care.",
            "Staff were rushing and my order was wrong. No apology was offered.",
            "Very unfriendly experience. The cashier barely looked up during my order.",
            "The team seemed undertrained and confused during the busy period.",
            "I was told to 'just wait' when I asked about my missing order. Unacceptable.",
            "Staff were overwhelmed and taking out their frustration on customers.",
            "No one acknowledged the app issues. Just told me it's not their problem.",
        ],
        "neutral": [
            "Staff were fine. Nothing exceptional but got the job done.",
            "Service was professional but a bit robotic. Could use more warmth.",
            "Team seemed stretched thin. They were trying but clearly understaffed.",
        ],
    },
    "cleanliness": {
        "positive": [
            "The café was spotless. Really appreciate how clean everything was.",
            "Very hygienic environment. Tables were cleaned promptly between customers.",
            "Clean and well-maintained. Restrooms were also very tidy.",
            "Impressed by the cleanliness standards. Utensils were spotless.",
            "Everything felt fresh and well-maintained. Sets a great standard.",
        ],
        "negative": [
            "Tables were dirty and sticky when I arrived. Took ages to get cleaned.",
            "The restroom was in poor condition. Unacceptable for a food establishment.",
            "Found residue on my utensils. Raises serious hygiene concerns.",
            "The seating area was messy during peak hours. No one was cleaning up.",
            "The bin near the counter was overflowing. Doesn't look good.",
            "Spilled liquid on the counter area wasn't cleaned for 15 minutes.",
        ],
        "neutral": [
            "Cleanliness was average. A bit cluttered during the rush but manageable.",
            "Mostly clean. A few crumbs on the table when I sat down but fine overall.",
            "Standard cleanliness — nothing alarming but could be better.",
        ],
    },
    "price": {
        "positive": [
            "Great value for money. The portion sizes are generous for the price.",
            "Reasonably priced for the quality you get here. Will definitely return.",
            "The loyalty rewards make it excellent value. App discounts are great.",
            "Fair pricing for a premium health café experience. Worth every penny.",
        ],
        "negative": [
            "Prices have gone up again. Getting hard to justify a regular visit.",
            "Too expensive for what you get. Smaller portions and higher prices is a bad combo.",
            "The loyalty points take too long to accumulate. Feels like a gimmick.",
            "Paid a premium price for an average experience today. Not worth it.",
            "Six pounds for an Avocado Toast that was half the normal size. Outrageous.",
            "Price increases without quality improvements are driving me away.",
            "The rewards program changes devalued my existing points. That felt unfair.",
        ],
        "neutral": [
            "Prices are on the higher end but not unreasonable for the area.",
            "Fair pricing for what it is. Nothing that stands out positively or negatively.",
            "Price is acceptable given the quality, but there's not much room to increase.",
        ],
    },
    "app": {
        "positive": [
            "The app is smooth and intuitive. Pre-ordering saves so much time.",
            "Love the new app update. Tracking my order in real time is great.",
            "The rewards program in the app is easy to use. Redeemed my points today.",
            "App works perfectly. Pre-order was ready exactly on time.",
            "Digital ordering makes everything so convenient. Great app experience.",
        ],
        "negative": [
            "The app crashed twice during checkout. Had to reorder manually at the counter.",
            "Payment failed on the app even though my card is valid. Very frustrating.",
            "The app is slow and glitchy. Keeps logging me out randomly mid-order.",
            "Can't see allergen information clearly in the app. Needs urgent improvement.",
            "The app didn't apply my discount code. Wasted 10 minutes arguing with staff.",
            "App crashes every time I try to add items to my basket. Completely unusable.",
            "My order was placed successfully on the app but never showed up at the cafe.",
            "The app update completely broke the payment flow. Had to uninstall and reinstall.",
            "Loading times are terrible. The menu takes over 30 seconds to load on 4G.",
            "App shows items as available that are out of stock. Walked in for nothing.",
            "The push notification said my order was ready but staff had no record of it.",
            "Cannot update my dietary preferences in the app. The save button does nothing.",
        ],
        "neutral": [
            "The app works well enough. A few minor bugs but generally usable.",
            "App is functional but could use a design refresh and speed improvements.",
            "App experience is okay. Some rough edges but the core ordering works.",
        ],
    },
}

# Rating affinity per theme and sentiment
THEME_RATING_AFFINITY = {
    "food_quality": {"positive": [4, 5, 5],   "negative": [1, 1, 2], "neutral": [3]},
    "wait_time":    {"positive": [4, 5],       "negative": [1, 2, 2, 3], "neutral": [3, 4]},
    "staff":        {"positive": [4, 5, 5],   "negative": [1, 2], "neutral": [3, 4]},
    "cleanliness":  {"positive": [4, 5],       "negative": [1, 2, 3], "neutral": [3]},
    "price":        {"positive": [4, 5],       "negative": [2, 2, 3], "neutral": [3, 4]},
    "app":          {"positive": [4, 5],       "negative": [1, 1, 2, 2, 3], "neutral": [3]},
}


def random_date(start: date, end: date) -> str:
    delta = (end - start).days
    return (start + timedelta(days=random.randint(0, delta))).isoformat()


def generate_free_text_and_rating(
    month_cfg: dict,
) -> tuple[str, int, str]:
    """
    Pick a theme based on month's theme_weights, then sentiment, then text + rating.
    Returns (free_text, rating, theme).
    """
    themes = list(month_cfg["theme_weights"].keys())
    weights = list(month_cfg["theme_weights"].values())
    theme = random.choices(themes, weights=weights)[0]

    sentiment = random.choices(
        ["positive", "negative", "neutral"],
        weights=month_cfg["sentiment_weights"],
    )[0]

    text = random.choice(FREE_TEXT_TEMPLATES[theme][sentiment])
    rating = random.choice(THEME_RATING_AFFINITY[theme][sentiment])
    return text, rating, theme


def generate_record(idx: int, month_name: str, month_cfg: dict) -> dict:
    survey = random.choice(SURVEYS)
    channel = random.choices(
        ["mobile", "web", "kiosk", "email"],
        weights=month_cfg["channel_weights"],
    )[0]

    date_str = random_date(month_cfg["start"], month_cfg["end"])
    free_text, rating, theme = generate_free_text_and_rating(month_cfg)

    return {
        "response_id": f"r{idx:07d}",
        "date": date_str,
        "business_id": BUSINESS_ID,
        "business_name": BUSINESS_NAME,
        "survey_id": survey["survey_id"],
        "survey_name": survey["survey_name"],
        "rating": rating,
        "response_channel": channel,
        "free_text": free_text,
        "primary_theme": theme,        # for analytics (not used by LLM tooling)
        "month": month_name,           # for fast month-level queries
    }


def main():
    total = sum(cfg["count"] for cfg in MONTH_CONFIGS.values())
    print(f"Generating {total:,} survey responses (Jan–May 2026)...")
    print("Narrative arc: 72% → 68% → 74% → 59% → 39% CSAT\n")

    records = []
    idx = 1

    for month_name, cfg in MONTH_CONFIGS.items():
        count = cfg["count"]
        for _ in tqdm(range(count), desc=f"{month_name.capitalize():>9} ({count:,} records)"):
            records.append(generate_record(idx, month_name, cfg))
            idx += 1

    # Shuffle so date order is realistic (mixed months)
    random.shuffle(records)

    output = {
        "metadata": {
            "business": BUSINESS_NAME,
            "total_responses": len(records),
            "date_range": "2026-01-01 to 2026-05-31",
            "months": list(MONTH_CONFIGS.keys()),
            "narrative": "App reliability crisis in Apr-May drove CSAT from 74% (March peak) to 39% (May trough)",
        },
        "responses": records,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(f"\n[OK] Saved {len(records):,} records → {OUTPUT_PATH}")
    for month_name, cfg in MONTH_CONFIGS.items():
        print(f"   {month_name.capitalize()}: {cfg['count']:,} responses")
    print(f"   File size: {os.path.getsize(OUTPUT_PATH) / 1_048_576:.1f} MB")


if __name__ == "__main__":
    main()
