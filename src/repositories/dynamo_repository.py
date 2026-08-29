"""
DynamoDB Single-Table implementation of BaseRepository.
Handles Notes, Cards, Decks, Review Logs, Session Savepoints, User Preferences, and Async Jobs.
"""

from decimal import Decimal
import os
from typing import Dict, List, Optional, Any, Tuple
import boto3
from boto3.dynamodb.conditions import Key, Attr

from domain.models import Note, Card, CardState, NoteType, DeckMetadata, UserPreferences
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

    @staticmethod
    def _deck_sk(deck_id: str) -> str:
        clean_deck = deck_id.replace("DECK#", "").lower()
        return f"DECK#{clean_deck}"

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
        self.batch_save_notes_and_cards([note], cards)

    def batch_save_notes_and_cards(self, notes: List[Note], cards: List[Card]) -> None:
        """Batch saves multiple notes and derived cards in a single transactional batch."""
        with self.table.batch_writer() as batch:
            for note in notes:
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

            for card in cards:
                pk = self._user_pk(card.user_id)
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

    def get_all_cards(self, user_id: str, deck_id: Optional[str] = None) -> List[Card]:
        """Retrieves all cards belonging to a user (optionally filtered by deck)."""
        pk = self._user_pk(user_id)
        response = self.table.query(
            KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("CARD#")
        )
        items = response.get("Items", [])
        cards = []
        for raw in items:
            item = decimal_to_float(raw)
            if deck_id and item.get("deck_id", "").lower() != deck_id.lower():
                continue
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
        return cards

    def get_due_cards(
        self,
        user_id: str,
        current_time_iso: str,
        deck_id: Optional[str] = None,
        limit: int = 50,
        exclusive_start_key: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Card], Optional[Dict[str, Any]]]:
        """Queries GSI1 with GSI1PK = USER#<sub_cognito> and GSI1SK <= DUE#<current_time_iso>."""
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
            if deck_id and item.get("deck_id", "").lower() != deck_id.lower():
                continue
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
        except Exception:
            return None

    def save_review_log(self, user_id: str, card_id: str, log_data: Dict[str, Any]) -> None:
        """Saves historical review event for analytics and streak calculation."""
        pk = self._user_pk(user_id)
        timestamp = log_data.get("timestamp", datetime_now_iso())
        sk = f"REV#{timestamp}#{card_id}"
        item = {
            "PK": pk,
            "SK": sk,
            "entity_type": "REVIEW_LOG",
            "user_id": user_id,
            "card_id": card_id,
            "deck_id": log_data.get("deck_id", ""),
            "rating": log_data.get("rating", 3),
            "review_time_ms": log_data.get("review_time_ms", 0),
            "stability": log_data.get("stability", 0.0),
            "difficulty": log_data.get("difficulty", 0.0),
            "timestamp": timestamp,
        }
        self.table.put_item(Item=float_to_decimal(item))

    def get_review_logs(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieves review history logs for a user."""
        pk = self._user_pk(user_id)
        response = self.table.query(
            KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("REV#")
        )
        return [decimal_to_float(item) for item in response.get("Items", [])]

    def save_session_savepoint(self, user_id: str, session_data: Dict[str, Any]) -> None:
        pk = self._user_pk(user_id)
        sk = "SESSION_SAVEPOINT"
        item = {
            "PK": pk,
            "SK": sk,
            "entity_type": "SESSION_SAVEPOINT",
            "user_id": user_id,
            "session_data": session_data,
            "updated_at": datetime_now_iso(),
        }
        self.table.put_item(Item=float_to_decimal(item))

    def get_session_savepoint(self, user_id: str) -> Optional[Dict[str, Any]]:
        pk = self._user_pk(user_id)
        sk = "SESSION_SAVEPOINT"
        res = self.table.get_item(Key={"PK": pk, "SK": sk})
        item = res.get("Item")
        return decimal_to_float(item.get("session_data")) if item else None

    def save_deck_metadata(self, deck: DeckMetadata) -> None:
        pk = self._user_pk(deck.user_id)
        sk = self._deck_sk(deck.deck_id)
        item = {
            "PK": pk,
            "SK": sk,
            "entity_type": "DECK",
            "user_id": deck.user_id,
            "deck_id": deck.deck_id.lower(),
            "title": deck.title or deck.deck_id,
            "description": deck.description or "",
            "is_favorite": deck.is_favorite,
            "tags": deck.tags,
            "created_at": deck.created_at,
            "updated_at": deck.updated_at,
        }
        self.table.put_item(Item=float_to_decimal(item))

    def get_decks(self, user_id: str) -> List[DeckMetadata]:
        pk = self._user_pk(user_id)
        res = self.table.query(
            KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("DECK#")
        )
        return [
            DeckMetadata(
                user_id=item["user_id"],
                deck_id=item["deck_id"],
                title=item.get("title"),
                description=item.get("description"),
                is_favorite=item.get("is_favorite", False),
                tags=item.get("tags", []),
                created_at=item.get("created_at", ""),
                updated_at=item.get("updated_at", ""),
            )
            for item in (decimal_to_float(i) for i in res.get("Items", []))
        ]

    def delete_deck(self, user_id: str, deck_id: str) -> None:
        pk = self._user_pk(user_id)
        sk = self._deck_sk(deck_id)
        self.table.delete_item(Key={"PK": pk, "SK": sk})

    def save_user_preferences(self, prefs: UserPreferences) -> None:
        pk = self._user_pk(prefs.user_id)
        sk = "USER_PREFERENCES"
        item = {
            "PK": pk,
            "SK": sk,
            "entity_type": "USER_PREFERENCES",
            "user_id": prefs.user_id,
            "daily_goal": prefs.daily_goal,
            "desired_retention": prefs.desired_retention,
            "max_interval_days": prefs.max_interval_days,
            "language": prefs.language,
            "updated_at": prefs.updated_at,
        }
        self.table.put_item(Item=float_to_decimal(item))

    def get_user_preferences(self, user_id: str) -> UserPreferences:
        pk = self._user_pk(user_id)
        sk = "USER_PREFERENCES"
        res = self.table.get_item(Key={"PK": pk, "SK": sk})
        item = res.get("Item")
        if not item:
            return UserPreferences(user_id=user_id)
        item = decimal_to_float(item)
        return UserPreferences(
            user_id=item["user_id"],
            daily_goal=item.get("daily_goal", 20),
            desired_retention=float(item.get("desired_retention", 0.90)),
            max_interval_days=int(item.get("max_interval_days", 36500)),
            language=item.get("language", "pt-BR"),
            updated_at=item.get("updated_at", ""),
        )

    def save_job(self, user_id: str, job_id: str, status: str, result: Dict[str, Any]) -> None:
        pk = self._user_pk(user_id)
        sk = f"JOB#{job_id}"
        item = {
            "PK": pk,
            "SK": sk,
            "entity_type": "JOB",
            "user_id": user_id,
            "job_id": job_id,
            "status": status,
            "result": result,
            "updated_at": datetime_now_iso(),
        }
        self.table.put_item(Item=float_to_decimal(item))

    def get_job(self, user_id: str, job_id: str) -> Optional[Dict[str, Any]]:
        pk = self._user_pk(user_id)
        sk = f"JOB#{job_id}"
        res = self.table.get_item(Key={"PK": pk, "SK": sk})
        item = res.get("Item")
        return decimal_to_float(item) if item else None


def datetime_now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
