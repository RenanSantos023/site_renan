"""
Unit tests for the FSRS v4.5 Core Engine.
"""

from datetime import datetime, timezone, timedelta
import pytest
from src.domain.fsrs import (
    calculate_retrievability,
    calculate_next_interval,
    initial_stability,
    initial_difficulty,
    next_difficulty,
    next_recall_stability,
    next_forget_stability,
    process_fsrs,
    DEFAULT_WEIGHTS,
)


def test_retrievability_at_time_zero():
    assert calculate_retrievability(0.0, 3.0) == 1.0
    assert calculate_retrievability(0.0, 10.0) == 1.0


def test_retrievability_decay_over_time():
    s = 5.0
    r_1_day = calculate_retrievability(1.0, s)
    r_5_days = calculate_retrievability(5.0, s)
    r_30_days = calculate_retrievability(30.0, s)

    assert 0.0 < r_30_days < r_5_days < r_1_day < 1.0
    assert calculate_retrievability(0.0, 0.0) == 0.0
    assert calculate_retrievability(-1.0, 5.0) == 1.0


def test_calculate_next_interval():
    # When R_target = 0.9, interval is roughly equal to stability
    assert calculate_next_interval(1.0, 0.90) == 1
    assert calculate_next_interval(5.0, 0.90) == 5
    assert calculate_next_interval(15.69, 0.90) == 16
    assert calculate_next_interval(0.0, 0.90) == 1
    # Higher retention target requires shorter review interval
    assert calculate_next_interval(10.0, 0.95) < calculate_next_interval(10.0, 0.85)


def test_initial_stability_and_difficulty():
    # Ratings: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
    s_again = initial_stability(1)
    s_hard = initial_stability(2)
    s_good = initial_stability(3)
    s_easy = initial_stability(4)

    assert s_again == DEFAULT_WEIGHTS[0]
    assert s_hard == DEFAULT_WEIGHTS[1]
    assert s_good == DEFAULT_WEIGHTS[2]
    assert s_easy == DEFAULT_WEIGHTS[3]
    assert s_again < s_hard < s_good < s_easy

    d_again = initial_difficulty(1)
    d_hard = initial_difficulty(2)
    d_good = initial_difficulty(3)
    d_easy = initial_difficulty(4)

    assert 1.0 <= d_easy < d_good < d_hard <= d_again <= 10.0


def test_next_difficulty_bounds():
    # Difficulty should never exceed [1.0, 10.0]
    d_high = next_difficulty(9.5, 1)
    assert 1.0 <= d_high <= 10.0

    d_low = next_difficulty(1.2, 4)
    assert 1.0 <= d_low <= 10.0

    # Neutral review (3 = Good) changes difficulty mildly towards mean
    d_good = next_difficulty(5.0, 3)
    assert 1.0 <= d_good <= 10.0


def test_process_fsrs_new_card_all_ratings():
    now = datetime(2026, 8, 20, 12, 0, 0, tzinfo=timezone.utc)
    new_card = {
        "state": "NEW",
        "stability": 0.0,
        "difficulty": 0.0,
    }

    # Rating 1 (Again)
    res_1 = process_fsrs(rating=1, card=new_card, now=now)
    assert res_1["state"] == "LEARNING"
    assert res_1["stability"] == round(DEFAULT_WEIGHTS[0], 4)

    # Rating 2 (Hard)
    res_2 = process_fsrs(rating=2, card=new_card, now=now)
    assert res_2["state"] == "REVIEW"
    assert res_2["stability"] == round(DEFAULT_WEIGHTS[1], 4)

    # Rating 3 (Good)
    res_3 = process_fsrs(rating=3, card=new_card, now=now)
    assert res_3["state"] == "REVIEW"
    assert res_3["stability"] == round(DEFAULT_WEIGHTS[2], 4)

    # Rating 4 (Easy)
    res_4 = process_fsrs(rating=4, card=new_card, now=now)
    assert res_4["state"] == "REVIEW"
    assert res_4["stability"] == round(DEFAULT_WEIGHTS[3], 4)

    # Validate ordering
    assert res_1["stability"] < res_2["stability"] < res_3["stability"] < res_4["stability"]
    assert res_1["difficulty"] > res_2["difficulty"] > res_3["difficulty"] > res_4["difficulty"]


def test_process_fsrs_review_card_good_vs_again():
    now = datetime(2026, 8, 25, 12, 0, 0, tzinfo=timezone.utc)
    last_review = datetime(2026, 8, 20, 12, 0, 0, tzinfo=timezone.utc)
    existing_card = {
        "state": "REVIEW",
        "stability": 3.173,
        "difficulty": 5.0,
        "last_review_date": last_review.isoformat(),
    }

    # Hard rating (G=2)
    res_hard = process_fsrs(rating=2, card=existing_card, now=now)
    assert res_hard["state"] == "REVIEW"
    assert res_hard["stability"] > existing_card["stability"]

    # Good rating (G=3)
    res_good = process_fsrs(rating=3, card=existing_card, now=now)
    assert res_good["state"] == "REVIEW"
    assert res_good["stability"] > res_hard["stability"]
    assert res_good["scheduled_days"] >= 3

    # Easy rating (G=4)
    res_easy = process_fsrs(rating=4, card=existing_card, now=now)
    assert res_easy["stability"] > res_good["stability"]
    assert res_easy["scheduled_days"] > res_good["scheduled_days"]

    # Again rating (G=1 Lapse)
    res_again = process_fsrs(rating=1, card=existing_card, now=now)
    assert res_again["state"] == "LEARNING"
    assert res_again["stability"] <= existing_card["stability"]
    assert res_again["difficulty"] > existing_card["difficulty"]
