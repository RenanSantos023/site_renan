"""
FSRS v4.5 (Free Spaced Repetition Scheduler) Core Engine.
Pure Python implementation of the FSRS algorithm for spaced repetition scheduling.
Supports 5 card states: NEW, LEARNING, REVIEW, DIFFICULT, MASTERED.
"""

from datetime import datetime, timezone, timedelta
import math
from typing import Optional, Dict, Any

# FSRS v4.5 Default Weights
DEFAULT_WEIGHTS = [
    0.40255, 1.18385, 3.173, 15.69105, 
    7.1949, 0.5345, 1.4604, 0.0046, 
    1.5457, 0.1192, 1.0192, 1.9395, 
    0.11, 0.29605, 2.2698, 0.2315, 
    2.9898, 0.51655, 0.6621
]

DEFAULT_R_TARGET = 0.90  # Desired retention: 90%


def classify_card_state(
    stability: float,
    difficulty: float,
    scheduled_days: int,
    base_state: str = "REVIEW"
) -> str:
    """
    Classifies the high-level operational state of a card for Analytics/UI:
    - NEW: stability == 0 or base_state == "NEW"
    - MASTERED: stability > 15.0 or (base_state == "REVIEW" and scheduled_days > 21)
    - DIFFICULT: difficulty >= 7.5 and stability <= 15.0
    - LEARNING: base_state == "LEARNING"
    - REVIEW: default mature review
    """
    if base_state == "NEW" or stability <= 0.0:
        return "NEW"
    if stability > 15.0 or (base_state == "REVIEW" and scheduled_days > 21):
        return "MASTERED"
    if difficulty >= 7.5:
        return "DIFFICULT"
    if base_state == "LEARNING":
        return "LEARNING"
    return "REVIEW"


def calculate_retrievability(t_days: float, stability: float) -> float:
    """
    Calculates probability of recalling the card after t_days.
    R(t, S) = (1 + t / (9 * S))^-1
    """
    if stability <= 0.0:
        return 0.0
    return (1.0 + max(0.0, t_days) / (9.0 * stability)) ** -1.0


def calculate_next_interval(stability: float, r_target: float = DEFAULT_R_TARGET) -> int:
    """
    Calculates the scheduled interval in days to reach the target retention.
    I(S, R_target) = 9 * S * ((1 / R_target) - 1)
    """
    if stability <= 0.0:
        return 1
    new_interval = 9.0 * stability * ((1.0 / r_target) - 1.0)
    return max(1, round(new_interval))


def initial_stability(rating: int, weights: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Calculates initial stability for new cards: S_0(G) = w_{G-1}
    Rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
    """
    rating_idx = max(1, min(4, rating)) - 1
    return weights[rating_idx]


def initial_difficulty(rating: int, weights: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Calculates initial difficulty for new cards:
    D_0(G) = min(max(w_4 - exp(w_5 * (G - 1)) + 1, 1), 10)
    """
    rating_val = max(1, min(4, rating))
    raw_d = weights[4] - math.exp(weights[5] * (rating_val - 1)) + 1.0
    return min(max(raw_d, 1.0), 10.0)


def next_difficulty(old_difficulty: float, rating: int, weights: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Calculates updated difficulty after review:
    D_0(3) = w_4 - exp(w_5 * 2) + 1
    Delta D = -w_6 * (G - 3)
    D' = D + Delta D
    D_new = min(max(w_7 * D_0(3) + (1 - w_7) * D', 1), 10)
    """
    rating_val = max(1, min(4, rating))
    d_0_good = weights[4] - math.exp(weights[5] * 2) + 1.0
    delta_d = -weights[6] * (rating_val - 3)
    d_prime = old_difficulty + delta_d
    new_d = weights[7] * d_0_good + (1.0 - weights[7]) * d_prime
    return min(max(new_d, 1.0), 10.0)


def next_recall_stability(
    difficulty: float,
    stability: float,
    retrievability: float,
    rating: int,
    weights: list[float] = DEFAULT_WEIGHTS,
) -> float:
    """
    Calculates updated stability when card is remembered (G >= 2).
    """
    w_factor = 1.0
    if rating == 2:
        w_factor = weights[15]
    elif rating == 4:
        w_factor = weights[16]

    hard_easy_boost = (
        math.exp(weights[8])
        * (11.0 - difficulty)
        * (stability ** -weights[9])
        * (math.exp(weights[10] * (1.0 - retrievability)) - 1.0)
        * w_factor
    )
    return stability * (1.0 + hard_easy_boost)


def next_forget_stability(
    difficulty: float,
    stability: float,
    retrievability: float,
    weights: list[float] = DEFAULT_WEIGHTS,
) -> float:
    """
    Calculates updated stability when card is forgotten (G == 1).
    S_forget = w_11 * D^-w_12 * ((S + 1)^w_13 - 1) * exp(w_14 * (1 - R))
    Capped at current stability.
    """
    s_forget = (
        weights[11]
        * (difficulty ** -weights[12])
        * (((stability + 1.0) ** weights[13]) - 1.0)
        * math.exp(weights[14] * (1.0 - retrievability))
    )
    return max(0.1, min(s_forget, stability))


def process_fsrs(
    rating: int,
    card: Dict[str, Any],
    now: Optional[datetime] = None,
    weights: list[float] = DEFAULT_WEIGHTS,
    r_target: float = DEFAULT_R_TARGET,
) -> Dict[str, Any]:
    """
    Processes a card review and computes next FSRS state and schedule.

    Args:
        rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
        card: Card data containing 'state', 'stability', 'difficulty', 'last_review_date', etc.
        now: Reference datetime (defaults to current UTC datetime)
        weights: FSRS weights
        r_target: Target retention rate

    Returns:
        Dict with updated 'stability', 'difficulty', 'due_date', 'state', 'scheduled_days', 'last_review_date'
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    state = card.get("state", "NEW")
    current_stability = float(card.get("stability", 0.0))
    current_difficulty = float(card.get("difficulty", 0.0))

    # 1. New Cards (First Review)
    if state == "NEW" or current_stability <= 0.0:
        new_s = initial_stability(rating, weights)
        new_d = initial_difficulty(rating, weights)
        final_state = "REVIEW" if rating > 1 else "LEARNING"
    else:
        # 2. Cards in Ongoing Review
        last_review_str = card.get("last_review_date") or card.get("created_at")
        if last_review_str:
            last_review = datetime.fromisoformat(last_review_str)
            if last_review.tzinfo is None:
                last_review = last_review.replace(tzinfo=timezone.utc)
            t_days = max(0.0, (now - last_review).total_seconds() / 86400.0)
        else:
            t_days = 0.0

        r = calculate_retrievability(t_days, current_stability)
        new_d = next_difficulty(current_difficulty, rating, weights)

        if rating == 1:  # Errou (Lapse)
            new_s = next_forget_stability(new_d, current_stability, r, weights)
            final_state = "LEARNING"
        else:  # Acertou (Recall: 2=Hard, 3=Good, 4=Easy)
            new_s = next_recall_stability(new_d, current_stability, r, rating, weights)
            final_state = "REVIEW"

    # 3. Scheduling next review
    interval_days = calculate_next_interval(new_s, r_target)
    due_date = now + timedelta(days=interval_days)

    return {
        "stability": round(new_s, 4),
        "difficulty": round(new_d, 4),
        "state": final_state,
        "last_review_date": now.isoformat(),
        "due_date": due_date.isoformat(),
        "scheduled_days": interval_days,
    }
