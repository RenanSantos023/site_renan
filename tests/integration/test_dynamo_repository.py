"""
Integration tests for DynamoRepository using moto mock_aws.
"""

import os
from datetime import datetime, timezone, timedelta
import boto3
import pytest
from moto import mock_aws

from src.domain.models import Note, Card, NoteType, CardState, generate_id
from src.repositories.dynamo_repository import DynamoRepository

TABLE_NAME = "AnkiSaaS-Test"


@pytest.fixture
def dynamodb_table():
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


def test_save_and_get_note(dynamodb_table):
    repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=dynamodb_table)

    note = Note(
        user_id="usr_user1",
        deck_id="deck_math",
        note_type=NoteType.BASIC,
        fields={"Front": "2 + 2", "Back": "4"},
        tags=["math", "basic"],
    )

    repo.save_note(note)

    fetched = repo.get_note(user_id="usr_user1", note_id=note.note_id)
    assert fetched is not None
    assert fetched.note_id == note.note_id
    assert fetched.deck_id == "deck_math"
    assert fetched.fields["Front"] == "2 + 2"
    assert fetched.tags == ["math", "basic"]

    # Multi-tenant isolation: other user cannot fetch note
    other_user_fetched = repo.get_note(user_id="usr_other", note_id=note.note_id)
    assert other_user_fetched is None


def test_save_and_get_card(dynamodb_table):
    repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=dynamodb_table)

    card = Card(
        user_id="usr_user1",
        note_id="not_123",
        deck_id="deck_math",
        card_ordinal=0,
        state=CardState.NEW,
        stability=0.0,
        difficulty=0.0,
        due_date="2026-08-20T12:00:00+00:00",
    )

    repo.save_card(card)

    fetched = repo.get_card(user_id="usr_user1", card_id=card.card_id)
    assert fetched is not None
    assert fetched.card_id == card.card_id
    assert fetched.state == CardState.NEW
    assert fetched.stability == 0.0
    assert fetched.due_date == "2026-08-20T12:00:00+00:00"


def test_save_note_with_cards_batch(dynamodb_table):
    repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=dynamodb_table)

    note = Note(
        user_id="usr_user1",
        deck_id="deck_vocab",
        note_type=NoteType.BASIC_REVERSED,
        fields={"Front": "Cat", "Back": "Gato"},
    )
    cards = [
        Card(user_id=note.user_id, note_id=note.note_id, deck_id=note.deck_id, card_ordinal=0),
        Card(user_id=note.user_id, note_id=note.note_id, deck_id=note.deck_id, card_ordinal=1),
    ]

    repo.save_note_with_cards(note, cards)

    assert repo.get_note("usr_user1", note.note_id) is not None
    assert repo.get_card("usr_user1", cards[0].card_id) is not None
    assert repo.get_card("usr_user1", cards[1].card_id) is not None


def test_get_due_cards_query_gsi1(dynamodb_table):
    repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=dynamodb_table)

    now = datetime(2026, 8, 20, 12, 0, 0, tzinfo=timezone.utc)
    due_past = (now - timedelta(days=1)).isoformat()
    due_now = now.isoformat()
    due_future = (now + timedelta(days=5)).isoformat()

    # User 1 cards
    card_past = Card(user_id="usr_user1", note_id="n1", deck_id="d1", due_date=due_past)
    card_now = Card(user_id="usr_user1", note_id="n2", deck_id="d1", due_date=due_now)
    card_future = Card(user_id="usr_user1", note_id="n3", deck_id="d1", due_date=due_future)

    # User 2 card (should never leak to User 1)
    card_user2 = Card(user_id="usr_user2", note_id="n4", deck_id="d1", due_date=due_past)

    repo.save_card(card_past)
    repo.save_card(card_now)
    repo.save_card(card_future)
    repo.save_card(card_user2)

    # Query user 1 due cards up to now
    due_cards_u1, last_key = repo.get_due_cards(user_id="usr_user1", current_time_iso=now.isoformat())
    card_ids_u1 = [c.card_id for c in due_cards_u1]

    assert len(due_cards_u1) == 2
    assert card_past.card_id in card_ids_u1
    assert card_now.card_id in card_ids_u1
    assert card_future.card_id not in card_ids_u1
    assert card_user2.card_id not in card_ids_u1


def test_update_card_fsrs_review(dynamodb_table):
    repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=dynamodb_table)

    card = Card(
        user_id="usr_user1",
        note_id="n1",
        deck_id="d1",
        state=CardState.NEW,
        stability=0.0,
        difficulty=0.0,
        due_date="2026-08-20T12:00:00+00:00",
    )
    repo.save_card(card)

    fsrs_result = {
        "stability": 3.173,
        "difficulty": 5.0,
        "state": "REVIEW",
        "last_review_date": "2026-08-20T12:05:00+00:00",
        "due_date": "2026-08-23T12:05:00+00:00",
        "scheduled_days": 3,
    }

    updated = repo.update_card_fsrs_review(user_id="usr_user1", card_id=card.card_id, fsrs_result=fsrs_result)

    assert updated is not None
    assert updated.state == CardState.REVIEW
    assert updated.stability == 3.173
    assert updated.difficulty == 5.0
    assert updated.due_date == "2026-08-23T12:05:00+00:00"
    assert updated.scheduled_days == 3
