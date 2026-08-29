"""
Lambda handler for User Preferences and FSRS configuration (GET /user/preferences, PUT /user/preferences).
"""

import json
from typing import Dict, Any

from domain.models import UserPreferences, current_iso_time
from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.responses import success_response, bad_request_response, error_response


def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        http_method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "GET")
        repo = DynamoRepository()

        if http_method == "GET":
            prefs = repo.get_user_preferences(user_id=user_id)
            return success_response(prefs.model_dump())

        if http_method in ("POST", "PUT"):
            body = json.loads(event.get("body", "{}") or "{}")
            desired_retention = float(body.get("desired_retention", 0.90))
            if desired_retention < 0.5 or desired_retention > 0.99:
                return bad_request_response("desired_retention must be between 0.50 and 0.99.")

            daily_goal = int(body.get("daily_goal", 20))
            if daily_goal < 1 or daily_goal > 500:
                return bad_request_response("daily_goal must be between 1 and 500.")

            prefs = UserPreferences(
                user_id=user_id,
                daily_goal=daily_goal,
                desired_retention=desired_retention,
                max_interval_days=int(body.get("max_interval_days", 36500)),
                language=body.get("language", "pt-BR"),
                updated_at=current_iso_time(),
            )
            repo.save_user_preferences(prefs)
            return success_response(prefs.model_dump())

        return bad_request_response("Unsupported HTTP method for preferences.")

    except json.JSONDecodeError:
        return bad_request_response("Malformed JSON body.")
    except Exception as e:
        return error_response(f"User preferences error: {str(e)}")
