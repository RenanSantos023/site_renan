"""
Lambda handler for Decks Management, Filtering, Metadata CRUD, and Multi-Tenant Sharing.
Endpoints:
- GET /decks
- POST /decks
- PUT /decks/{deckId}
- DELETE /decks/{deckId}
- POST /decks/{deckId}/share
- POST /decks/import-shared
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, List
import uuid

from domain.models import DeckMetadata, Note, Card, NoteType, CardState
from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.responses import success_response, bad_request_response, error_response


def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        path = event.get("rawPath") or event.get("path") or "/decks"
        http_method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "GET")
        body = json.loads(event.get("body", "{}") or "{}") if http_method in ("POST", "PUT") else {}

        repo = DynamoRepository()
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. POST /decks/import-shared
        if "import-shared" in path and http_method == "POST":
            deck_bundle = body.get("bundle") or body
            notes_data = deck_bundle.get("notes", [])
            target_deck = (body.get("target_deck_id") or deck_bundle.get("deck_id") or "importado").lower()

            new_notes: List[Note] = []
            new_cards: List[Card] = []

            for n in notes_data:
                note = Note(
                    user_id=user_id,
                    deck_id=target_deck,
                    note_type=NoteType(n.get("note_type", "BASIC")),
                    fields=n.get("fields", {}),
                    tags=n.get("tags", [target_deck]),
                )
                from domain.models import generate_cards_from_note
                cards = generate_cards_from_note(note)
                new_notes.append(note)
                new_cards.extend(cards)

            repo.batch_save_notes_and_cards(new_notes, new_cards)
            repo.save_deck_metadata(
                DeckMetadata(
                    user_id=user_id,
                    deck_id=target_deck,
                    title=body.get("title", target_deck.capitalize()),
                    description="Baralho importado de compartilhamento.",
                    tags=[target_deck],
                )
            )

            return success_response({
                "message": f"Successfully imported shared deck '{target_deck}' with {len(new_notes)} notes.",
                "deck_id": target_deck,
                "notes_imported": len(new_notes),
            }, status_code=201)

        # 2. POST /decks/{deckId}/share
        if "/share" in path and http_method == "POST":
            path_parts = path.strip("/").split("/")
            deck_id = path_parts[1] if len(path_parts) > 2 else body.get("deck_id", "")
            if not deck_id:
                return bad_request_response("Deck ID is required for sharing.")

            cards = repo.get_all_cards(user_id=user_id, deck_id=deck_id)
            notes_dict = {}
            for c in cards:
                if c.note_id not in notes_dict:
                    note = repo.get_note(user_id=user_id, note_id=c.note_id)
                    if note:
                        notes_dict[c.note_id] = {
                            "note_type": note.note_type.value if hasattr(note.note_type, "value") else str(note.note_type),
                            "fields": note.fields,
                            "tags": note.tags,
                        }

            share_code = f"deck_{uuid.uuid4().hex[:8]}"
            export_bundle = {
                "share_code": share_code,
                "deck_id": deck_id,
                "notes_count": len(notes_dict),
                "cards_count": len(cards),
                "notes": list(notes_dict.values()),
                "created_at": now_iso,
            }

            return success_response(export_bundle)

        # 3. GET /decks (Consolidated List with Metrics)
        if http_method == "GET":
            decks_metadata = repo.get_decks(user_id=user_id)
            cards = repo.get_all_cards(user_id=user_id)
            now = datetime.now(timezone.utc)

            # Aggregate stats per deck
            stats_by_deck: Dict[str, Dict[str, Any]] = {}
            for c in cards:
                d = (c.deck_id or "geral").lower()
                if d not in stats_by_deck:
                    stats_by_deck[d] = {
                        "deck_id": d,
                        "card_count": 0,
                        "due_count": 0,
                        "new_count": 0,
                        "learning_count": 0,
                        "mastered_count": 0,
                        "latest_update": c.updated_at,
                    }
                entry = stats_by_deck[d]
                entry["card_count"] += 1
                if not c.due_date or datetime.fromisoformat(c.due_date.replace("Z", "+00:00")) <= now:
                    entry["due_count"] += 1
                if c.state == "NEW":
                    entry["new_count"] += 1
                elif c.state == "LEARNING":
                    entry["learning_count"] += 1
                elif c.state == "MASTERED" or c.stability > 15.0:
                    entry["mastered_count"] += 1

            # Merge with explicitly created decks
            merged_decks = []
            known_ids = set()

            for meta in decks_metadata:
                d_id = meta.deck_id.lower()
                known_ids.add(d_id)
                stats = stats_by_deck.get(d_id, {
                    "card_count": 0,
                    "due_count": 0,
                    "new_count": 0,
                    "learning_count": 0,
                    "mastered_count": 0,
                    "latest_update": meta.updated_at,
                })
                total = max(1, stats["card_count"])
                merged_decks.append({
                    "deck_id": d_id,
                    "title": meta.title or d_id.capitalize(),
                    "description": meta.description or "",
                    "is_favorite": meta.is_favorite,
                    "tags": meta.tags,
                    **stats,
                    "mastery_percent": min(100, round((stats["mastered_count"] / total) * 100)) if stats["card_count"] > 0 else 0,
                })

            for d_id, stats in stats_by_deck.items():
                if d_id not in known_ids:
                    total = max(1, stats["card_count"])
                    merged_decks.append({
                        "deck_id": d_id,
                        "title": d_id.capitalize(),
                        "description": "",
                        "is_favorite": False,
                        "tags": [d_id],
                        **stats,
                        "mastery_percent": min(100, round((stats["mastered_count"] / total) * 100)),
                    })

            return success_response({"decks": merged_decks, "count": len(merged_decks)})

        # 4. POST /decks (Create Deck)
        if http_method == "POST":
            deck_id = body.get("deck_id", "").strip().lower()
            if not deck_id:
                return bad_request_response("deck_id is required.")
            deck_meta = DeckMetadata(
                user_id=user_id,
                deck_id=deck_id,
                title=body.get("title", deck_id.capitalize()),
                description=body.get("description", ""),
                is_favorite=body.get("is_favorite", False),
                tags=body.get("tags", [deck_id]),
            )
            repo.save_deck_metadata(deck_meta)
            return success_response(deck_meta.model_dump(), status_code=201)

        # 5. PUT /decks/{deckId}
        if http_method == "PUT":
            path_parts = path.strip("/").split("/")
            deck_id = path_parts[1] if len(path_parts) > 1 else body.get("deck_id", "")
            deck_meta = DeckMetadata(
                user_id=user_id,
                deck_id=deck_id.lower(),
                title=body.get("title"),
                description=body.get("description"),
                is_favorite=body.get("is_favorite", False),
                tags=body.get("tags", []),
                updated_at=now_iso,
            )
            repo.save_deck_metadata(deck_meta)
            return success_response(deck_meta.model_dump())

        # 6. DELETE /decks/{deckId}
        if http_method == "DELETE":
            path_parts = path.strip("/").split("/")
            deck_id = path_parts[1] if len(path_parts) > 1 else ""
            if not deck_id:
                return bad_request_response("deck_id is required for deletion.")
            repo.delete_deck(user_id=user_id, deck_id=deck_id)
            return success_response({"message": f"Deck '{deck_id}' metadata removed successfully."})

        return bad_request_response("Unsupported deck action or method.")

    except Exception as e:
        return error_response(f"Deck management error: {str(e)}")
