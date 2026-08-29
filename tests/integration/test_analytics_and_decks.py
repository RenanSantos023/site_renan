"""
Integration tests for Analytics Summary, Decks Management CRUD & Sharing, and User Preferences.
"""

import json
import boto3
import pytest
from moto import mock_aws

from handlers.analytics_summary import lambda_handler as analytics_handler
from handlers.manage_decks import lambda_handler as decks_handler
from handlers.user_preferences import lambda_handler as preferences_handler
from repositories.dynamo_repository import DynamoRepository
from domain.models import Note, Card, NoteType, CardState

TABLE_NAME = "AnkiSaaS-Test"


@pytest.fixture
def setup_dynamo():
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
        yield dynamodb


def test_analytics_summary(setup_dynamo, monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=setup_dynamo)

    # Insert sample card and review log
    user_id = "usr_analytics_user"
    card = Card(
        user_id=user_id,
        card_id="crd_1",
        note_id="not_1",
        deck_id="python",
        state=CardState.MASTERED,
        stability=18.0,
    )
    repo.save_card(card)
    repo.save_review_log(user_id=user_id, card_id="crd_1", log_data={
        "deck_id": "python",
        "rating": 4,
        "review_time_ms": 1500,
        "timestamp": "2026-08-29T10:00:00+00:00",
    })

    event = {
        "headers": {"X-User-Id": user_id},
        "path": "/analytics/summary",
        "httpMethod": "GET"
    }
    response = analytics_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["summary"]["mastered_cards"] == 1
    assert "gamification" in body
    assert "heatmap" in body


def test_decks_crud_and_share(setup_dynamo, monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    user_id = "usr_deck_tester"

    # 1. Create deck
    create_evt = {
        "headers": {"X-User-Id": user_id},
        "path": "/decks",
        "httpMethod": "POST",
        "body": json.dumps({
            "deck_id": "aws-cloud",
            "title": "AWS Cloud Practitioner",
            "description": "Certificação AWS",
            "is_favorite": True
        })
    }
    res = decks_handler(create_evt, None)
    assert res["statusCode"] == 201

    # 2. List decks
    list_evt = {
        "headers": {"X-User-Id": user_id},
        "path": "/decks",
        "httpMethod": "GET"
    }
    res_list = decks_handler(list_evt, None)
    assert res_list["statusCode"] == 200
    body_list = json.loads(res_list["body"])
    assert len(body_list["decks"]) >= 1

    # 3. Share deck
    share_evt = {
        "headers": {"X-User-Id": user_id},
        "path": "/decks/aws-cloud/share",
        "httpMethod": "POST",
    }
    res_share = decks_handler(share_evt, None)
    assert res_share["statusCode"] == 200
    body_share = json.loads(res_share["body"])
    assert "share_code" in body_share
    assert body_share["deck_id"] == "aws-cloud"


def test_user_preferences_crud(setup_dynamo, monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    user_id = "usr_pref_user"

    # 1. Update preferences
    put_evt = {
        "headers": {"X-User-Id": user_id},
        "path": "/user/preferences",
        "httpMethod": "PUT",
        "body": json.dumps({
            "daily_goal": 35,
            "desired_retention": 0.92,
            "language": "pt-BR"
        })
    }
    res_put = preferences_handler(put_evt, None)
    assert res_put["statusCode"] == 200
    body_put = json.loads(res_put["body"])
    assert body_put["daily_goal"] == 35
    assert body_put["desired_retention"] == 0.92

    # 2. Get preferences
    get_evt = {
        "headers": {"X-User-Id": user_id},
        "path": "/user/preferences",
        "httpMethod": "GET"
    }
    res_get = preferences_handler(get_evt, None)
    assert res_get["statusCode"] == 200
    body_get = json.loads(res_get["body"])
    assert body_get["daily_goal"] == 35
