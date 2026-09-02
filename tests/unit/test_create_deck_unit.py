"""
Unit tests for Create Deck functionality (POST /decks) in accordance with docs/99_feature_criar_baralho.md
"""

import json
import pytest
from unittest.mock import MagicMock, patch

from src.handlers.manage_decks import lambda_handler


def create_apigw_event(method="POST", path="/decks", body=None, user_sub="test_cognito_sub_123"):
    """Helper to mock API Gateway HTTP API v2 event."""
    return {
        "rawPath": path,
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
            },
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": user_sub,
                        "email": "user@test.com",
                    }
                }
            }
        },
        "body": json.dumps(body) if body is not None else "{}",
    }


@patch("src.handlers.manage_decks.DynamoRepository")
def test_create_deck_success_valid_payload(mock_repo_cls):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo

    payload = {
        "name": "Inglês - Verbos Irregulares",
        "description": "Vocabulário de verbos irregulares"
    }
    event = create_apigw_event(method="POST", path="/decks", body=payload)

    response = lambda_handler(event)
    assert response["statusCode"] == 201

    body = json.loads(response["body"])
    assert "id" in body
    assert body["name"] == "Inglês - Verbos Irregulares"
    assert body["description"] == "Vocabulário de verbos irregulares"
    assert "createdAt" in body
    assert "updatedAt" in body

    # Verify repository call
    mock_repo.save_deck_metadata.assert_called_once()
    saved_meta = mock_repo.save_deck_metadata.call_args[0][0]
    assert saved_meta.user_id == "test_cognito_sub_123"
    assert saved_meta.title == "Inglês - Verbos Irregulares"
    assert saved_meta.description == "Vocabulário de verbos irregulares"


@patch("src.handlers.manage_decks.DynamoRepository")
def test_create_deck_without_description(mock_repo_cls):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo

    payload = {
        "name": "Python Avançado"
    }
    event = create_apigw_event(method="POST", path="/decks", body=payload)

    response = lambda_handler(event)
    assert response["statusCode"] == 201

    body = json.loads(response["body"])
    assert body["name"] == "Python Avançado"
    assert body["description"] == ""


@patch("src.handlers.manage_decks.DynamoRepository")
def test_create_deck_empty_name_fails(mock_repo_cls):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo

    for invalid_name in ["", "   "]:
        payload = {"name": invalid_name}
        event = create_apigw_event(method="POST", path="/decks", body=payload)
        response = lambda_handler(event)
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert "error" in body
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "Informe um nome para o baralho" in body["error"]["message"]


@patch("src.handlers.manage_decks.DynamoRepository")
def test_create_deck_name_exceeding_100_chars_fails(mock_repo_cls):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo

    payload = {"name": "A" * 101}
    event = create_apigw_event(method="POST", path="/decks", body=payload)
    response = lambda_handler(event)
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "máximo 100 caracteres" in body["error"]["message"]


@patch("src.handlers.manage_decks.DynamoRepository")
def test_create_deck_description_exceeding_500_chars_fails(mock_repo_cls):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo

    payload = {
        "name": "Nome Válido",
        "description": "D" * 501
    }
    event = create_apigw_event(method="POST", path="/decks", body=payload)
    response = lambda_handler(event)
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "máximo 500 caracteres" in body["error"]["message"]


@patch("src.handlers.manage_decks.DynamoRepository")
def test_create_deck_ignores_client_user_id(mock_repo_cls):
    """Ensure ownership is strictly extracted from JWT claim, not payload."""
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo

    payload = {
        "name": "Baralho Seguro",
        "userId": "attacker_user_sub_999"
    }
    event = create_apigw_event(method="POST", path="/decks", body=payload, user_sub="legit_user_sub_123")
    response = lambda_handler(event)
    assert response["statusCode"] == 201

    saved_meta = mock_repo.save_deck_metadata.call_args[0][0]
    assert saved_meta.user_id == "legit_user_sub_123"
