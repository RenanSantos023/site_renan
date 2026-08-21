"""
Authentication and multi-tenant user extraction utilities from API Gateway v2 events.
"""

from typing import Dict, Any, Optional


def extract_user_id(event: Dict[str, Any]) -> str:
    """
    Extracts the authenticated user's ID (sub) from the API Gateway HTTP API v2 event.
    Fallbacks to custom headers or test headers when running in non-Cognito environments.
    """
    # 1. API Gateway HTTP API v2 JWT Authorizer
    try:
        claims = (
            event.get("requestContext", {})
            .get("authorizer", {})
            .get("jwt", {})
            .get("claims", {})
        )
        if "sub" in claims:
            return claims["sub"]
        if "cognito:username" in claims:
            return claims["cognito:username"]
    except Exception:
        pass

    # 2. Fallback for custom / IAM context
    try:
        iam_user = (
            event.get("requestContext", {})
            .get("authorizer", {})
            .get("iam", {})
            .get("userId")
        )
        if iam_user:
            return iam_user
    except Exception:
        pass

    # 3. Fallback for header (dev / direct integration testing)
    headers = event.get("headers", {}) or {}
    user_header = headers.get("x-user-id") or headers.get("X-User-Id")
    if user_header:
        return user_header

    # 4. Fallback for local testing or unauthenticated dev mode
    return "usr_dev_default"
