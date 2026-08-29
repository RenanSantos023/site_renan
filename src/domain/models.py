"""
Domain models for Flashcards SaaS (Note, Card, Review, Enums, Batch, Decks, Preferences).
"""

from enum import Enum, IntEnum
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from domain.cloze_parser import extract_cloze_numbers, render_cloze_card


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
    DIFFICULT = "DIFFICULT"
    MASTERED = "MASTERED"


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


class BatchNoteCreateRequest(BaseModel):
    notes: List[NoteCreateRequest]


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
    stability: float
    difficulty: float
    next_review: str
    interval_days: int


class DeckMetadata(BaseModel):
    user_id: str
    deck_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    is_favorite: bool = False
    tags: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=current_iso_time)
    updated_at: str = Field(default_factory=current_iso_time)


class UserPreferences(BaseModel):
    user_id: str
    daily_goal: int = 20
    desired_retention: float = 0.90
    max_interval_days: int = 36500
    language: str = "pt-BR"
    updated_at: str = Field(default_factory=current_iso_time)


def generate_cards_from_note(note: Note, now_iso: Optional[str] = None) -> List[Card]:
    """
    Business Rule: Generates 1 to N derived cards from a Note based on note_type.
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
            numbers = extract_cloze_numbers(field_val)
            for n in numbers:
                cloze_numbers.add(n)

        if not cloze_numbers:
            cloze_numbers.add(1)

        for ordinal, _ in enumerate(sorted(cloze_numbers)):
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
