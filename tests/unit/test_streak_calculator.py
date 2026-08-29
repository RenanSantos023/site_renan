"""
Unit tests for Streak and Heatmap calculations.
"""

from datetime import datetime, timezone, timedelta
from handlers.analytics_summary import calculate_streak


def test_streak_calculation_continuous():
    today = datetime(2026, 8, 29, 12, 0, 0, tzinfo=timezone.utc)
    dates = [
        today,
        today - timedelta(days=1),
        today - timedelta(days=2),
        today - timedelta(days=3),
    ]
    streak = calculate_streak(dates, today)
    assert streak == 4


def test_streak_calculation_yesterday_active():
    today = datetime(2026, 8, 29, 12, 0, 0, tzinfo=timezone.utc)
    # Studied yesterday and the day before, but hasn't studied today yet (streak is still intact)
    dates = [
        today - timedelta(days=1),
        today - timedelta(days=2),
    ]
    streak = calculate_streak(dates, today)
    assert streak == 2


def test_streak_calculation_broken():
    today = datetime(2026, 8, 29, 12, 0, 0, tzinfo=timezone.utc)
    # Last study was 3 days ago (streak broken)
    dates = [
        today - timedelta(days=3),
        today - timedelta(days=4),
    ]
    streak = calculate_streak(dates, today)
    assert streak == 0


def test_streak_empty():
    today = datetime(2026, 8, 29, 12, 0, 0, tzinfo=timezone.utc)
    assert calculate_streak([], today) == 0
