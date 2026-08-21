"""
Base interface for Card and Note persistence layer.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Tuple
from domain.models import Note, Card


class BaseRepository(ABC):
    @abstractmethod
    def save_note(self, note: Note) -> None:
        """Persists a single Note."""
        pass

    @abstractmethod
    def save_card(self, card: Card) -> None:
        """Persists a single Card."""
        pass

    @abstractmethod
    def save_note_with_cards(self, note: Note, cards: List[Card]) -> None:
        """Persists a Note along with all its derived Cards atomically."""
        pass

    @abstractmethod
    def get_note(self, user_id: str, note_id: str) -> Optional[Note]:
        """Fetches a Note by user_id and note_id."""
        pass

    @abstractmethod
    def get_card(self, user_id: str, card_id: str) -> Optional[Card]:
        """Fetches a Card by user_id and card_id."""
        pass

    @abstractmethod
    def get_due_cards(
        self,
        user_id: str,
        current_time_iso: str,
        limit: int = 50,
        exclusive_start_key: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Card], Optional[Dict[str, Any]]]:
        """Fetches due cards for a user up to current_time_iso using GSI1."""
        pass

    @abstractmethod
    def update_card_fsrs_review(
        self,
        user_id: str,
        card_id: str,
        fsrs_result: Dict[str, Any],
    ) -> Optional[Card]:
        """Updates a Card's FSRS attributes and moves GSI1SK to new due date."""
        pass
