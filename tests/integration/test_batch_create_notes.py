"""
Integration tests for Batch Create Notes handler (POST /notes/batch).
"""

import json
import boto3
import pytest
from moto import mock_aws

from handlers.batch_create_notes import lambda_handler
from repositories.dynamo_repository import DynamoRepository

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


def test_batch_create_notes_handler(setup_dynamo, monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)

    event = {
        "headers": {"X-User-Id": "usr_batch_test"},
        "body": json.dumps({
            "notes": [
                {
                    "deck_id": "python",
                    "note_type": "BASIC",
                    "fields": {"Front": "O que é PEP 8?", "Back": "Guia de estilo oficial de Python"},
                    "tags": ["python", "clean-code"]
                },
                {
                    "deck_id": "python",
                    "note_type": "BASIC_REVERSED",
                    "fields": {"Front": "List Comprehension", "Back": "[x for x in iterable]"},
                    "tags": ["python", "syntax"]
                },
                {
                    "deck_id": "biologia",
                    "note_type": "CLOZE",
                    "fields": {"Text": "A {{c1::clorofila}} absorve a luz e {{c2::libera oxigênio}}."},
                    "tags": ["biologia", "enem"]
                }
            ]
        })
    }

    response = lambda_handler(event, None)
    assert response["statusCode"] == 201

    body = json.loads(response["body"])
    assert body["notes_created"] == 3
    # 1 basic (1 card) + 1 basic_reversed (2 cards) + 1 cloze with c1 and c2 (2 cards) = 5 cards
    assert body["cards_created"] == 5

    # Verify directly from DynamoDB
    repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=setup_dynamo)
    cards = repo.get_all_cards("usr_batch_test")
    assert len(cards) == 5
