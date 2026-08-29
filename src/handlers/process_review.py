"""
AWS Lambda Handler: ProcessReviewFunction (POST /study/review)
Integrates FSRS v4.5 algorithm to update card state, stability, difficulty, next due date,
and records review log for Streak/Analytics.
"""

import json
from typing import Dict, Any
from pydantic import ValidationError

from domain.fsrs import process_fsrs
from domain.models import ReviewRequest
from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.responses import success_response, error_response

_repository: DynamoRepository = None


def get_repository() -> DynamoRepository:
    global _repository
    if _repository is None:
        _repository = DynamoRepository()
    return _repository


def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return error_response("Unauthorized: User ID could not be identified", status_code=401)

        raw_body = event.get("body")
        if not raw_body:
            return error_response("Missing request body", status_code=400)

        if isinstance(raw_body, str):
            try:
                body = json.loads(raw_body)
            except json.JSONDecodeError:
                return error_response("Invalid JSON body", status_code=400)
        else:
            body = raw_body

        try:
            req = ReviewRequest(**body)
        except ValidationError as e:
            return error_response("Validation error", status_code=400, details=e.errors())

        repo = get_repository()
        card = repo.get_card(user_id=user_id, card_id=req.card_id)
        if not card:
            return error_response(f"Card '{req.card_id}' not found", status_code=404)

        # Execute FSRS calculation
        card_data = card.model_dump()
        fsrs_result = process_fsrs(rating=req.rating.value, card=card_data)

        # Update DynamoDB item
        updated_card = repo.update_card_fsrs_review(
            user_id=user_id,
            card_id=req.card_id,
            fsrs_result=fsrs_result,
        )

        if not updated_card:
            return error_response("Failed to update card review", status_code=500)

        # Record Review Log for Analytics & Streak
        repo.save_review_log(
            user_id=user_id,
            card_id=req.card_id,
            log_data={
                "deck_id": updated_card.deck_id,
                "rating": req.rating.value,
                "review_time_ms": req.review_time_ms or 0,
                "stability": updated_card.stability,
                "difficulty": updated_card.difficulty,
                "timestamp": fsrs_result["last_review_date"],
            },
        )

        response_payload = {
            "card_id": updated_card.card_id,
            "state": updated_card.state.value if hasattr(updated_card.state, "value") else str(updated_card.state),
            "next_review": updated_card.due_date,
            "interval_days": updated_card.scheduled_days,
            "stability": updated_card.stability,
            "difficulty": updated_card.difficulty,
        }

        return success_response(response_payload, status_code=200)

    except Exception as exc:
        return error_response(f"Internal server error: {str(exc)}", status_code=500)
