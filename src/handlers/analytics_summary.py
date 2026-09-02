"""
Lambda handler for Analytics Summary, Streak calculation, Heatmap, and Weak Topics (GET /analytics/summary).
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
import math

from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.responses import success_response, error_response


def calculate_streak(review_dates: List[datetime], today: datetime) -> int:
    """Calculates continuous consecutive days of study."""
    if not review_dates:
        return 0

    unique_days = sorted(list({d.date() for d in review_dates}), reverse=True)
    today_date = today.date()
    yesterday_date = today_date - timedelta(days=1)

    if not unique_days or (unique_days[0] != today_date and unique_days[0] != yesterday_date):
        return 0

    streak = 0
    current_check = unique_days[0]

    for day in unique_days:
        if day == current_check:
            streak += 1
            current_check -= timedelta(days=1)
        elif day < current_check:
            break

    return streak


def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        repo = DynamoRepository()
        now = datetime.now(timezone.utc)

        # 1. Fetch all cards for volume categorization
        cards = repo.get_all_cards(user_id=user_id)
        total_cards = len(cards)

        mastered_count = sum(1 for c in cards if c.state == "MASTERED" or c.stability > 15.0 or (c.state == "REVIEW" and c.scheduled_days > 21))
        difficult_count = sum(1 for c in cards if c.state == "DIFFICULT" or (c.difficulty >= 7.5 and c.stability <= 15.0))
        learning_count = sum(1 for c in cards if c.state == "LEARNING" or (c.stability <= 2.0 and c.state != "NEW"))
        new_count = sum(1 for c in cards if c.state == "NEW" or c.stability == 0.0)
        review_count = max(0, total_cards - (mastered_count + learning_count + new_count))

        mastery_percent = min(100, round((mastered_count / max(1, total_cards)) * 100))

        # 2. Fetch Review Logs for Streak, Heatmap, Accuracy and Study Time
        logs = repo.get_review_logs(user_id=user_id)
        review_datetimes = []
        total_time_ms = 0
        correct_count = 0
        deck_stats: Dict[str, Dict[str, int]] = {}

        for log in logs:
            ts_str = log.get("timestamp")
            if ts_str:
                try:
                    dt = datetime.fromisoformat(ts_str)
                    review_datetimes.append(dt)
                except Exception:
                    pass

            rating = log.get("rating", 3)
            if rating in (3, 4):
                correct_count += 1
            total_time_ms += log.get("review_time_ms", 1200)

            deck = log.get("deck_id", "geral")
            if deck not in deck_stats:
                deck_stats[deck] = {"total": 0, "correct": 0}
            deck_stats[deck]["total"] += 1
            if rating in (3, 4):
                deck_stats[deck]["correct"] += 1

        # Calculate Streak
        streak_days = calculate_streak(review_datetimes, now) if total_cards > 0 else 0

        # Calculate Heatmap (last 365 days aggregated by YYYY-MM-DD)
        heatmap: Dict[str, int] = {}
        for dt in review_datetimes:
            key = dt.strftime("%Y-%m-%d")
            heatmap[key] = heatmap.get(key, 0) + 1

        accuracy_rate = round((correct_count / max(1, len(logs))) * 100) if (logs and total_cards > 0) else 0
        total_study_minutes = round(total_time_ms / 60000) if total_cards > 0 else 0

        # Identify Weak Topics only for existing active decks
        active_decks = { (c.deck_id or "").lower() for c in cards }
        weak_topics = []
        if total_cards > 0:
            for deck, stats in deck_stats.items():
                if deck.lower() not in active_decks:
                    continue
                acc = round((stats["correct"] / max(1, stats["total"])) * 100)
                weak_topics.append({
                    "topic": deck.capitalize(),
                    "deck": deck,
                    "accuracy": acc,
                    "total_reviews": stats["total"]
                })
            weak_topics.sort(key=lambda x: x["accuracy"])

        response_data = {
            "summary": {
                "total_cards": total_cards,
                "mastered_cards": mastered_count if total_cards > 0 else 0,
                "learning_cards": learning_count if total_cards > 0 else 0,
                "difficult_cards": difficult_count if total_cards > 0 else 0,
                "new_cards": new_count if total_cards > 0 else 0,
                "review_cards": review_count if total_cards > 0 else 0,
                "mastery_percent": mastery_percent if total_cards > 0 else 0,
            },
            "gamification": {
                "streak_days": streak_days,
                "record_streak_days": streak_days if total_cards > 0 else 0,
                "total_reviews": len(logs) if total_cards > 0 else 0,
                "total_study_minutes": total_study_minutes,
                "accuracy_rate": accuracy_rate,
            },
            "heatmap": heatmap if total_cards > 0 else {},
            "weak_topics": weak_topics[:5],
            "timestamp": now.isoformat(),
        }

        return success_response(response_data)

    except Exception as e:
        return error_response(f"Analytics calculation error: {str(e)}")
