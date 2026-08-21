"""
Unit tests for Domain Models and Card Generation rules.
"""

import pytest
from src.domain.models import (
    Note,
    NoteType,
    CardState,
    generate_cards_from_note,
    ReviewRequest,
    Rating,
)


def test_basic_note_generates_single_card():
    note = Note(
        user_id="usr_test_123",
        deck_id="deck_456",
        note_type=NoteType.BASIC,
        fields={"Front": "What is Python?", "Back": "A programming language"},
        tags=["programming", "python"],
    )

    cards = generate_cards_from_note(note)
    assert len(cards) == 1
    card = cards[0]
    assert card.user_id == note.user_id
    assert card.note_id == note.note_id
    assert card.deck_id == note.deck_id
    assert card.card_ordinal == 0
    assert card.state == CardState.NEW
    assert card.stability == 0.0
    assert card.difficulty == 0.0


def test_basic_reversed_note_generates_two_cards():
    note = Note(
        user_id="usr_test_123",
        deck_id="deck_456",
        note_type=NoteType.BASIC_REVERSED,
        fields={"Front": "Dog", "Back": "Cachorro"},
        tags=["languages", "en-pt"],
    )

    cards = generate_cards_from_note(note)
    assert len(cards) == 2
    assert cards[0].card_ordinal == 0
    assert cards[1].card_ordinal == 1
    assert cards[0].note_id == note.note_id
    assert cards[1].note_id == note.note_id
    assert cards[0].card_id != cards[1].card_id
    assert cards[0].state == CardState.NEW
    assert cards[1].state == CardState.NEW


def test_cloze_note_generates_cards_per_cloze_index():
    note = Note(
        user_id="usr_test_123",
        deck_id="deck_456",
        note_type=NoteType.CLOZE,
        fields={"Text": "The {{c1::capital}} of France is {{c2::Paris}}."},
        tags=["geography"],
    )

    cards = generate_cards_from_note(note)
    assert len(cards) == 2
    assert cards[0].card_ordinal == 0
    assert cards[1].card_ordinal == 1
    assert cards[0].state == CardState.NEW
    assert cards[1].state == CardState.NEW


def test_review_request_validation():
    req = ReviewRequest(card_id="crd_123", rating=Rating.GOOD, review_time_ms=3500)
    assert req.rating == 3
    assert req.card_id == "crd_123"

    with pytest.raises(Exception):
        ReviewRequest(card_id="crd_123", rating=5)  # Rating must be 1..4
