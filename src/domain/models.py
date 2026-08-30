"""
Domain models for Flashcards SaaS (Note, Card, Review, Enums, Batch, Decks, Preferences, StudyLog, Analytics, AI Jobs).
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
    RELEARNING = "RELEARNING"
    MASTERED = "MASTERED"
    DIFFICULT = "DIFFICULT"


class Rating(IntEnum):
    AGAIN = 1
    HARD = 2
    GOOD = 3
    EASY = 4


class StudyMode(str, Enum):
    REVIEW = "REVIEW"
    QUIZ = "QUIZ"
    WRITTEN_ANSWER = "WRITTEN_ANSWER"
    GUIDED_TUTOR = "GUIDED_TUTOR"


class AiSourceType(str, Enum):
    TEXT = "TEXT"
    FILE = "FILE"
    URL = "URL"
    YOUTUBE = "YOUTUBE"
    IMAGE = "IMAGE"
    SCAN = "SCAN"
    VOICE = "VOICE"
    MANUAL = "MANUAL"


class AiJobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


def generate_id(prefix: str) -> str:
    """Generates a prefixed unique identifier (e.g., not_abc123 or crd_xyz789)."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def current_iso_time() -> str:
    """Returns current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


# -----------------------------------------------------------------------------
# Notes & Cards Models
# -----------------------------------------------------------------------------

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
    elapsed_days: int = 0
    scheduled_days: int = 0
    reps: int = 0
    lapses: int = 0
    due_date: str = Field(default_factory=current_iso_time)
    last_review_date: Optional[str] = None
    created_at: str = Field(default_factory=current_iso_time)
    updated_at: str = Field(default_factory=current_iso_time)


class ReviewRequest(BaseModel):
    card_id: str
    rating: Rating
    study_mode: StudyMode = StudyMode.REVIEW
    review_time_ms: Optional[int] = 0
    written_answer: Optional[str] = None


class ReviewResponse(BaseModel):
    card_id: str
    state: str
    stability: float
    difficulty: float
    next_review: str
    interval_days: int
    ai_feedback: Optional[str] = None
    ai_score_percent: Optional[int] = None


# -----------------------------------------------------------------------------
# Decks Models
# -----------------------------------------------------------------------------

class DeckMetadata(BaseModel):
    user_id: str
    deck_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = "BookOpen"
    color: Optional[str] = "#8b5cf6"
    category: Optional[str] = "Geral"
    is_favorite: bool = False
    tags: List[str] = Field(default_factory=list)
    total_notes: int = 0
    total_cards: int = 0
    created_at: str = Field(default_factory=current_iso_time)
    updated_at: str = Field(default_factory=current_iso_time)


# -----------------------------------------------------------------------------
# User Profile & Preferences Models
# -----------------------------------------------------------------------------

class UserPreferences(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    daily_goal: int = 20
    desired_retention: float = 0.90
    max_interval_days: int = 36500
    fsrs_weights: Optional[List[float]] = None
    language: str = "pt-BR"
    updated_at: str = Field(default_factory=current_iso_time)


# -----------------------------------------------------------------------------
# Study History & Analytics Models
# -----------------------------------------------------------------------------

class StudyLog(BaseModel):
    user_id: str
    log_id: str = Field(default_factory=lambda: generate_id("log"))
    card_id: str
    note_id: Optional[str] = None
    deck_id: str
    rating: Rating
    study_mode: StudyMode = StudyMode.REVIEW
    review_duration_ms: int = 0
    stability_before: float = 0.0
    stability_after: float = 0.0
    difficulty_before: float = 0.0
    difficulty_after: float = 0.0
    ai_score_percent: Optional[int] = None
    created_at: str = Field(default_factory=current_iso_time)


class DailyStats(BaseModel):
    user_id: str
    date: str  # YYYY-MM-DD
    cards_studied: int = 0
    time_spent_seconds: int = 0
    ratings_count: Dict[str, int] = Field(default_factory=lambda: {"again": 0, "hard": 0, "good": 0, "easy": 0})
    retention_rate: float = 0.0


class WeakTopic(BaseModel):
    tag: str
    error_rate: float
    card_count: int


class UserAggregates(BaseModel):
    user_id: str
    current_streak: int = 0
    longest_streak: int = 0
    last_study_date: Optional[str] = None
    total_cards_studied: int = 0
    total_time_spent_seconds: int = 0
    weak_topics: List[WeakTopic] = Field(default_factory=list)
    updated_at: str = Field(default_factory=current_iso_time)


# -----------------------------------------------------------------------------
# AI Jobs & Multimodal Ingestion Models
# -----------------------------------------------------------------------------

class AiJob(BaseModel):
    user_id: str
    job_id: str = Field(default_factory=lambda: generate_id("job"))
    deck_id: str
    source_type: AiSourceType
    status: AiJobStatus = AiJobStatus.PENDING
    source_payload_or_key: str
    generated_notes: List[Dict[str, Any]] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=current_iso_time)
    completed_at: Optional[str] = None


# -----------------------------------------------------------------------------
# Card Generation from Note Logic
# -----------------------------------------------------------------------------

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
