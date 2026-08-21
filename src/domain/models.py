"""
Domain models for Flashcards SaaS (Note, Card, Review, Enums).
"""

from enum import Enum, IntEnum
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class NoteType(str, Enum):
    BASIC = "BASIC"
    BASIC_REVERSED = "BASIC_REVERSED"
    CLOZE = "CLOZE"
    TYPE_ANSWER = "TYPE_ANSWER"
    IMAGE_OCCLUSION = "IMAGE_OCCLUSION"


class CardState(str, Enum):
    NEW = "NEW"
    LEARNING = "LEARNING"
    REVIEW = "REVIEW"


class Rating(IntEnum):
    AGAIN = 1
    HARD = 2
    GOOD = 3
    EASY = 4


def generate_id(prefix: str) -> str:
    """Generates a prefixed unique identifier (e.g., not_abc123 or crd_xyz789)."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def current_iso_time() -> str:
    """Returns current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


class NoteCreateRequest(BaseModel):
    deck_id: str
    note_type: NoteType = NoteType.BASIC
    fields: Dict[str, str]
    tags: List[str] = Field(default_factory=list)


class Note(BaseModel):
    user_id: str
    note_id: str = Field(default_factory=lambda: generate_id("not"))
    deck_id: str
    note_type: NoteType = NoteType.BASIC
    fields: Dict[str, str]
    tags: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=current_iso_time)
    updated_at: str = Field(default_factory=current_iso_time)


class Card(BaseModel):
    user_id: str
    card_id: str = Field(default_factory=lambda: generate_id("crd"))
    note_id: str
    deck_id: str
    card_ordinal: int = 0
    state: CardState = CardState.NEW
    stability: float = 0.0
    difficulty: float = 0.0
    due_date: str = Field(default_factory=current_iso_time)
    last_review_date: Optional[str] = None
    scheduled_days: int = 0
    created_at: str = Field(default_factory=current_iso_time)
    updated_at: str = Field(default_factory=current_iso_time)


class ReviewRequest(BaseModel):
    card_id: str
    rating: Rating
    review_time_ms: Optional[int] = 0


class ReviewResponse(BaseModel):
    card_id: str
    state: str
    next_review: str
    interval_days: int


CLOZE_PATTERN = re.compile(r"\{\{c(\d+)::(.*?)\}\}")


def generate_cards_from_note(note: Note, now_iso: Optional[str] = None) -> List[Card]:
    """
    Business Rule RN-02: Generates 1 to N derived cards from a Note based on note_type.
    All cards start in NEW state with stability=0 and difficulty=0.
    """
    timestamp = now_iso or current_iso_time()
    cards: List[Card] = []

    if note.note_type == NoteType.BASIC:
        cards.append(
            Card(
                user_id=note.user_id,
                card_id=generate_id("crd"),
                note_id=note.note_id,
                deck_id=note.deck_id,
                card_ordinal=0,
                state=CardState.NEW,
                stability=0.0,
                difficulty=0.0,
                due_date=timestamp,
                created_at=timestamp,
                updated_at=timestamp,
            )
        )

    elif note.note_type == NoteType.BASIC_REVERSED:
        # Card 0: Front -> Back
        cards.append(
            Card(
                user_id=note.user_id,
                card_id=generate_id("crd"),
                note_id=note.note_id,
                deck_id=note.deck_id,
                card_ordinal=0,
                state=CardState.NEW,
                stability=0.0,
                difficulty=0.0,
                due_date=timestamp,
                created_at=timestamp,
                updated_at=timestamp,
            )
        )
        # Card 1: Back -> Front
        cards.append(
            Card(
                user_id=note.user_id,
                card_id=generate_id("crd"),
                note_id=note.note_id,
                deck_id=note.deck_id,
                card_ordinal=1,
                state=CardState.NEW,
                stability=0.0,
                difficulty=0.0,
                due_date=timestamp,
                created_at=timestamp,
                updated_at=timestamp,
            )
        )

    elif note.note_type == NoteType.CLOZE:
        # Find all cloze markers like {{c1::...}}, {{c2::...}}
        cloze_numbers = set()
        for field_val in note.fields.values():
            matches = CLOZE_PATTERN.findall(field_val)
            for match in matches:
                cloze_numbers.add(int(match[0]))

        if not cloze_numbers:
            cloze_numbers.add(1)

        for ordinal, cloze_idx in enumerate(sorted(cloze_numbers)):
            cards.append(
                Card(
                    user_id=note.user_id,
                    card_id=generate_id("crd"),
                    note_id=note.note_id,
                    deck_id=note.deck_id,
                    card_ordinal=ordinal,
                    state=CardState.NEW,
                    stability=0.0,
                    difficulty=0.0,
                    due_date=timestamp,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
            )

    else:
        # Default single card (e.g. TYPE_ANSWER, IMAGE_OCCLUSION)
        cards.append(
            Card(
                user_id=note.user_id,
                card_id=generate_id("crd"),
                note_id=note.note_id,
                deck_id=note.deck_id,
                card_ordinal=0,
                state=CardState.NEW,
                stability=0.0,
                difficulty=0.0,
                due_date=timestamp,
                created_at=timestamp,
                updated_at=timestamp,
            )
        )

    return cards
