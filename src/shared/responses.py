"""
Standardized HTTP response utilities for AWS Lambda and API Gateway v2.
"""

import json
from decimal import Decimal
from datetime import datetime, date
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel


class CustomJSONEncoder(json.JSONEncoder):
    """Encodes custom domain types, enums, decimals, and dates to JSON."""

    def default(self, o: Any) -> Any:
        if isinstance(o, BaseModel):
            return o.model_dump()
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        if isinstance(o, Decimal):
            if o % 1 == 0:
                return int(o)
            return float(o)
        if isinstance(o, Enum):
            return o.value
        return super().default(o)


CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def build_response(status_code: int, body: Any, extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    headers = {**CORS_HEADERS, **(extra_headers or {})}
    body_str = json.dumps(body, cls=CustomJSONEncoder) if not isinstance(body, str) else body
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": body_str,
    }


def success_response(data: Any, status_code: int = 200) -> Dict[str, Any]:
    return build_response(status_code=status_code, body=data)


def error_response(message: str, status_code: int = 400, details: Optional[Any] = None) -> Dict[str, Any]:
    error_payload: Dict[str, Any] = {"error": message}
    if details:
        error_payload["details"] = details
    return build_response(status_code=status_code, body=error_payload)
