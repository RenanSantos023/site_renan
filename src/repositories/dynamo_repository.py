"""
DynamoDB Single-Table implementation of BaseRepository.
"""

from decimal import Decimal
import os
from typing import Dict, List, Optional, Any, Tuple
import boto3
from boto3.dynamodb.conditions import Key

from domain.models import Note, Card, CardState, NoteType
from repositories.base import BaseRepository


def float_to_decimal(obj: Any) -> Any:
    """Recursively converts float values to Decimal for DynamoDB serialization."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: float_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [float_to_decimal(v) for v in obj]
    return obj


def decimal_to_float(obj: Any) -> Any:
    """Recursively converts Decimal values back to float/int."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [decimal_to_float(v) for v in obj]
    return obj


class DynamoRepository(BaseRepository):
    def __init__(
        self,
        table_name: Optional[str] = None,
        dynamodb_resource: Optional[Any] = None,
    ):
        self.table_name = table_name or os.environ.get("TABLE_NAME", "AnkiSaaS")
        if dynamodb_resource:
            self.dynamodb = dynamodb_resource
        else:
            self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(self.table_name)

    @staticmethod
    def _user_pk(user_id: str) -> str:
        clean_user = user_id.replace("USER#", "")
        return f"USER#{clean_user}"

    @staticmethod
    def _note_sk(note_id: str) -> str:
        clean_note = note_id.replace("NOTE#", "")
        return f"NOTE#{clean_note}"

    @staticmethod
    def _card_sk(card_id: str) -> str:
        clean_card = card_id.replace("CARD#", "")
        return f"CARD#{clean_card}"

    @staticmethod
    def _due_gsi_sk(due_date_iso: str) -> str:
        clean_due = due_date_iso.replace("DUE#", "")
        return f"DUE#{clean_due}"

    def save_note(self, note: Note) -> None:
        pk = self._user_pk(note.user_id)
        sk = self._note_sk(note.note_id)
        item = {
            "PK": pk,
            "SK": sk,
            "entity_type": "NOTE",
            "user_id": note.user_id,
            "note_id": note.note_id,
            "deck_id": note.deck_id,
            "note_type": note.note_type.value if hasattr(note.note_type, "value") else str(note.note_type),
            "fields": note.fields,
            "tags": note.tags,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
        }
        self.table.put_item(Item=float_to_decimal(item))

    def save_card(self, card: Card) -> None:
        pk = self._user_pk(card.user_id)
        sk = self._card_sk(card.card_id)
        gsi1_sk = self._due_gsi_sk(card.due_date)
        item = {
            "PK": pk,
            "SK": sk,
            "GSI1PK": pk,
            "GSI1SK": gsi1_sk,
            "entity_type": "CARD",
            "user_id": card.user_id,
            "card_id": card.card_id,
            "note_id": card.note_id,
            "deck_id": card.deck_id,
            "card_ordinal": card.card_ordinal,
            "state": card.state.value if hasattr(card.state, "value") else str(card.state),
            "stability": card.stability,
            "difficulty": card.difficulty,
            "due_date": card.due_date,
            "last_review_date": card.last_review_date,
            "scheduled_days": card.scheduled_days,
            "created_at": card.created_at,
            "updated_at": card.updated_at,
        }
        self.table.put_item(Item=float_to_decimal(item))

    def save_note_with_cards(self, note: Note, cards: List[Card]) -> None:
        """Saves note and derived cards using DynamoDB BatchWriteItem."""
        with self.table.batch_writer() as batch:
            # Note item
            pk = self._user_pk(note.user_id)
            sk = self._note_sk(note.note_id)
            note_item = {
                "PK": pk,
                "SK": sk,
                "entity_type": "NOTE",
                "user_id": note.user_id,
                "note_id": note.note_id,
                "deck_id": note.deck_id,
                "note_type": note.note_type.value if hasattr(note.note_type, "value") else str(note.note_type),
                "fields": note.fields,
                "tags": note.tags,
                "created_at": note.created_at,
                "updated_at": note.updated_at,
            }
            batch.put_item(Item=float_to_decimal(note_item))

            # Card items
            for card in cards:
                card_sk = self._card_sk(card.card_id)
                gsi1_sk = self._due_gsi_sk(card.due_date)
                card_item = {
                    "PK": pk,
                    "SK": card_sk,
                    "GSI1PK": pk,
                    "GSI1SK": gsi1_sk,
                    "entity_type": "CARD",
                    "user_id": card.user_id,
                    "card_id": card.card_id,
                    "note_id": card.note_id,
                    "deck_id": card.deck_id,
                    "card_ordinal": card.card_ordinal,
                    "state": card.state.value if hasattr(card.state, "value") else str(card.state),
                    "stability": card.stability,
                    "difficulty": card.difficulty,
                    "due_date": card.due_date,
                    "last_review_date": card.last_review_date,
                    "scheduled_days": card.scheduled_days,
                    "created_at": card.created_at,
                    "updated_at": card.updated_at,
                }
                batch.put_item(Item=float_to_decimal(card_item))

    def get_note(self, user_id: str, note_id: str) -> Optional[Note]:
        pk = self._user_pk(user_id)
        sk = self._note_sk(note_id)
        response = self.table.get_item(Key={"PK": pk, "SK": sk})
        item = response.get("Item")
        if not item:
            return None
        item = decimal_to_float(item)
        return Note(
            user_id=item["user_id"],
            note_id=item["note_id"],
            deck_id=item["deck_id"],
            note_type=NoteType(item["note_type"]),
            fields=item.get("fields", {}),
            tags=item.get("tags", []),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    def get_card(self, user_id: str, card_id: str) -> Optional[Card]:
        pk = self._user_pk(user_id)
        sk = self._card_sk(card_id)
        response = self.table.get_item(Key={"PK": pk, "SK": sk})
        item = response.get("Item")
        if not item:
            return None
        item = decimal_to_float(item)
        return Card(
            user_id=item["user_id"],
            card_id=item["card_id"],
            note_id=item["note_id"],
            deck_id=item.get("deck_id", ""),
            card_ordinal=int(item.get("card_ordinal", 0)),
            state=CardState(item["state"]),
            stability=float(item.get("stability", 0.0)),
            difficulty=float(item.get("difficulty", 0.0)),
            due_date=item["due_date"],
            last_review_date=item.get("last_review_date"),
            scheduled_days=int(item.get("scheduled_days", 0)),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    def get_due_cards(
        self,
        user_id: str,
        current_time_iso: str,
        limit: int = 50,
        exclusive_start_key: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Card], Optional[Dict[str, Any]]]:
        """
        Queries GSI1 with GSI1PK = USER#<sub_cognito> and GSI1SK <= DUE#<current_time_iso>.
        """
        pk = self._user_pk(user_id)
        gsi1_sk_limit = self._due_gsi_sk(current_time_iso)

        query_kwargs: Dict[str, Any] = {
            "IndexName": "GSI1",
            "KeyConditionExpression": Key("GSI1PK").eq(pk) & Key("GSI1SK").lte(gsi1_sk_limit),
            "Limit": limit,
        }
        if exclusive_start_key:
            query_kwargs["ExclusiveStartKey"] = exclusive_start_key

        response = self.table.query(**query_kwargs)
        items = response.get("Items", [])
        last_key = response.get("LastEvaluatedKey")

        cards: List[Card] = []
        for raw_item in items:
            item = decimal_to_float(raw_item)
            cards.append(
                Card(
                    user_id=item["user_id"],
                    card_id=item["card_id"],
                    note_id=item["note_id"],
                    deck_id=item.get("deck_id", ""),
                    card_ordinal=int(item.get("card_ordinal", 0)),
                    state=CardState(item["state"]),
                    stability=float(item.get("stability", 0.0)),
                    difficulty=float(item.get("difficulty", 0.0)),
                    due_date=item["due_date"],
                    last_review_date=item.get("last_review_date"),
                    scheduled_days=int(item.get("scheduled_days", 0)),
                    created_at=item["created_at"],
                    updated_at=item["updated_at"],
                )
            )

        return cards, last_key

    def update_card_fsrs_review(
        self,
        user_id: str,
        card_id: str,
        fsrs_result: Dict[str, Any],
    ) -> Optional[Card]:
        """
        Atomically updates card FSRS metrics and moves GSI1SK to new due date.
        """
        pk = self._user_pk(user_id)
        sk = self._card_sk(card_id)
        new_due_gsi_sk = self._due_gsi_sk(fsrs_result["due_date"])

        update_expr = (
            "SET #state = :state, "
            "#stability = :stability, "
            "#difficulty = :difficulty, "
            "#due_date = :due_date, "
            "#last_review_date = :last_review_date, "
            "#scheduled_days = :scheduled_days, "
            "#updated_at = :updated_at, "
            "#gsi1sk = :gsi1sk"
        )
        expr_attr_names = {
            "#state": "state",
            "#stability": "stability",
            "#difficulty": "difficulty",
            "#due_date": "due_date",
            "#last_review_date": "last_review_date",
            "#scheduled_days": "scheduled_days",
            "#updated_at": "updated_at",
            "#gsi1sk": "GSI1SK",
        }
        expr_attr_values = float_to_decimal(
            {
                ":state": fsrs_result["state"],
                ":stability": fsrs_result["stability"],
                ":difficulty": fsrs_result["difficulty"],
                ":due_date": fsrs_result["due_date"],
                ":last_review_date": fsrs_result["last_review_date"],
                ":scheduled_days": fsrs_result["scheduled_days"],
                ":updated_at": fsrs_result["last_review_date"],
                ":gsi1sk": new_due_gsi_sk,
            }
        )

        try:
            response = self.table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values,
                ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
                ReturnValues="ALL_NEW",
            )
            item = decimal_to_float(response.get("Attributes", {}))
            if not item:
                return None
            return Card(
                user_id=item["user_id"],
                card_id=item["card_id"],
                note_id=item["note_id"],
                deck_id=item.get("deck_id", ""),
                card_ordinal=int(item.get("card_ordinal", 0)),
                state=CardState(item["state"]),
                stability=float(item.get("stability", 0.0)),
                difficulty=float(item.get("difficulty", 0.0)),
                due_date=item["due_date"],
                last_review_date=item.get("last_review_date"),
                scheduled_days=int(item.get("scheduled_days", 0)),
                created_at=item["created_at"],
                updated_at=item["updated_at"],
            )
        except self.dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
            return None
