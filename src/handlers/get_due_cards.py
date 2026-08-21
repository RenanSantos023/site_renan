"""
AWS Lambda Handler: GetDueCardsFunction (GET /study/due)
"""

import base64
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.responses import success_response, error_response

_repository: DynamoRepository = None


def get_repository() -> DynamoRepository:
    global _repository
    if _repository is None:
        _repository = DynamoRepository()
    return _repository


def decode_pagination_token(token_str: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token_str:
        return None
    try:
        raw_json = base64.b64decode(token_str.encode("utf-8")).decode("utf-8")
        return json.loads(raw_json)
    except Exception:
        return None


def encode_pagination_token(last_key: Optional[Dict[str, Any]]) -> Optional[str]:
    if not last_key:
        return None
    try:
        from repositories.dynamo_repository import decimal_to_float
        clean_dict = decimal_to_float(last_key)
        raw_json = json.dumps(clean_dict)
        return base64.b64encode(raw_json.encode("utf-8")).decode("utf-8")
    except Exception:
        return None


def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return error_response("Unauthorized: User ID could not be identified", status_code=401)

        query_params = event.get("queryStringParameters") or {}
        limit_param = query_params.get("limit", "50")
        try:
            limit = int(limit_param)
            if limit <= 0 or limit > 200:
                limit = 50
        except ValueError:
            limit = 50

        next_token = query_params.get("next_token")
        exclusive_start_key = decode_pagination_token(next_token)

        now_iso = datetime.now(timezone.utc).isoformat()
        repo = get_repository()
        cards, last_evaluated_key = repo.get_due_cards(
            user_id=user_id,
            current_time_iso=now_iso,
            limit=limit,
            exclusive_start_key=exclusive_start_key,
        )

        response_data = {
            "cards": [card.model_dump() for card in cards],
            "count": len(cards),
            "next_token": encode_pagination_token(last_evaluated_key),
            "timestamp": now_iso,
        }

        return success_response(response_data, status_code=200)

    except Exception as exc:
        return error_response(f"Internal server error: {str(exc)}", status_code=500)
