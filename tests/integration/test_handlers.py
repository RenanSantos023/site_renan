"""
End-to-end integration tests for Lambda Handlers (CreateNote, GetDueCards, ProcessReview).
"""

import json
import os
from datetime import datetime, timezone, timedelta
import boto3
import pytest
from moto import mock_aws

from src.handlers import create_note, get_due_cards, process_review
from src.repositories.dynamo_repository import DynamoRepository

TABLE_NAME = "AnkiSaaS-Test"


@pytest.fixture(autouse=True)
def setup_dynamodb_env(monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")


@pytest.fixture
def mock_dynamodb():
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
        table = dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "GSI1PK", "AttributeType": "S"},
                {"AttributeName": "GSI1SK", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        table.wait_until_exists()

        # Initialize repository instance for handlers
        repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=dynamodb)
        create_note._repository = repo
        get_due_cards._repository = repo
        process_review._repository = repo

        yield repo


def test_create_note_handler_success(mock_dynamodb):
    event = {
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {"sub": "usr_test_sam_1"}
                }
            }
        },
        "body": json.dumps({
            "deck_id": "deck_aws_certs",
            "note_type": "BASIC",
            "fields": {
                "Front": "What is DynamoDB?",
                "Back": "A serverless NoSQL database"
            },
            "tags": ["aws", "database"]
        })
    }

    response = create_note.lambda_handler(event)
    assert response["statusCode"] == 201
    body = json.loads(response["body"])
    assert "note" in body
    assert body["cards_count"] == 1
    assert body["cards"][0]["state"] == "NEW"
    assert body["cards"][0]["stability"] == 0.0


def test_create_note_cloze(mock_dynamodb):
    event = {
        "requestContext": {
            "authorizer": {"jwt": {"claims": {"sub": "usr_cloze_user"}}}
        },
        "body": json.dumps({
            "deck_id": "deck_biology",
            "note_type": "CLOZE",
            "fields": {
                "Text": "The {{c1::heart}} pumps {{c2::blood}} through the {{c3::circulatory}} system."
            },
            "tags": ["biology", "anatomy"]
        })
    }

    response = create_note.lambda_handler(event)
    assert response["statusCode"] == 201
    body = json.loads(response["body"])
    assert body["cards_count"] == 3


def test_create_note_handler_validation_error(mock_dynamodb):
    event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": "usr_test_1"}}}},
        "body": json.dumps({"deck_id": "missing_fields"})
    }
    response = create_note.lambda_handler(event)
    assert response["statusCode"] == 400


def test_get_due_cards_handler_and_pagination(mock_dynamodb):
    user_id = "usr_student_pag"
    # Create 3 basic notes for this user
    for i in range(3):
        create_event = {
            "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
            "body": json.dumps({
                "deck_id": "deck_vocab",
                "note_type": "BASIC",
                "fields": {"Front": f"Word {i}", "Back": f"Meaning {i}"},
            })
        }
        create_note.lambda_handler(create_event)

    # Query with limit 2
    get_event_page1 = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
        "queryStringParameters": {"limit": "2"}
    }
    res_page1 = get_due_cards.lambda_handler(get_event_page1)
    assert res_page1["statusCode"] == 200
    body1 = json.loads(res_page1["body"])
    assert body1["count"] == 2
    assert body1["next_token"] is not None

    # Query page 2 with next_token
    get_event_page2 = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
        "queryStringParameters": {"limit": "2", "next_token": body1["next_token"]}
    }
    res_page2 = get_due_cards.lambda_handler(get_event_page2)
    assert res_page2["statusCode"] == 200
    body2 = json.loads(res_page2["body"])
    assert body2["count"] == 1

    # Query with all=true (returns all 3 cards)
    get_event_all = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
        "queryStringParameters": {"all": "true"}
    }
    res_all = get_due_cards.lambda_handler(get_event_all)
    assert res_all["statusCode"] == 200
    body_all = json.loads(res_all["body"])
    assert body_all["count"] == 3
    assert len(body_all["cards"]) == 3
    assert len(body_all["notes"]) == 3


def test_process_review_again_vs_easy_comparison(mock_dynamodb):
    user_id = "usr_comparison_tester"

    # Create Note with 2 cards (BASIC_REVERSED)
    create_event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
        "body": json.dumps({
            "deck_id": "deck_comparison",
            "note_type": "BASIC_REVERSED",
            "fields": {"Front": "Cat", "Back": "Gato"},
        })
    }
    create_res = create_note.lambda_handler(create_event)
    assert create_res["statusCode"] == 201
    cards = json.loads(create_res["body"])["cards"]
    card_again_id = cards[0]["card_id"]
    card_easy_id = cards[1]["card_id"]

    # Review Card 1 with Rating 1 (Again)
    review_again_event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
        "body": json.dumps({
            "card_id": card_again_id,
            "rating": 1,
            "review_time_ms": 5000
        })
    }
    res_again = process_review.lambda_handler(review_again_event)
    assert res_again["statusCode"] == 200
    body_again = json.loads(res_again["body"])
    assert body_again["state"] == "LEARNING"
    assert body_again["interval_days"] == 1

    # Review Card 2 with Rating 4 (Easy)
    review_easy_event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
        "body": json.dumps({
            "card_id": card_easy_id,
            "rating": 4,
            "review_time_ms": 2000
        })
    }
    res_easy = process_review.lambda_handler(review_easy_event)
    assert res_easy["statusCode"] == 200
    body_easy = json.loads(res_easy["body"])
    assert body_easy["state"] == "REVIEW"
    assert body_easy["interval_days"] >= 15
    assert body_easy["stability"] > body_again["stability"]


def test_multi_tenant_isolation(mock_dynamodb):
    user_a = "usr_alice"
    user_b = "usr_bob"

    # Alice creates a card
    create_event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_a}}}},
        "body": json.dumps({
            "deck_id": "deck_alice",
            "note_type": "BASIC",
            "fields": {"Front": "Alice Secret", "Back": "123"},
        })
    }
    alice_create = create_note.lambda_handler(create_event)
    alice_card_id = json.loads(alice_create["body"])["cards"][0]["card_id"]

    # Bob queries due cards -> should be empty
    bob_get_event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_b}}}},
    }
    bob_due = get_due_cards.lambda_handler(bob_get_event)
    assert json.loads(bob_due["body"])["count"] == 0

    # Bob tries to review Alice's card -> 404
    bob_review_event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_b}}}},
        "body": json.dumps({"card_id": alice_card_id, "rating": 3})
    }
    bob_review_res = process_review.lambda_handler(bob_review_event)
    assert bob_review_res["statusCode"] == 404


def test_process_review_handler_not_found(mock_dynamodb):
    review_event = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": "usr_test_1"}}}},
        "body": json.dumps({
            "card_id": "crd_nonexistent",
            "rating": 3
        })
    }
    response = process_review.lambda_handler(review_event)
    assert response["statusCode"] == 404
