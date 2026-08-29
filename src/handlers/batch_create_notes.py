"""
Lambda handler for Batch Note Creation (POST /notes/batch).
Persists multiple notes and their derived cards in DynamoDB within a single batch write.
"""

import json
from typing import Dict, Any
from pydantic import ValidationError

from domain.models import Note, BatchNoteCreateRequest, generate_cards_from_note, NoteType
from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.responses import success_response, bad_request_response, error_response


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        body = json.loads(event.get("body", "{}") or "{}")

        # Support either list directly or object with "notes" list
        notes_input = body if isinstance(body, list) else body.get("notes", [])
        if not notes_input or not isinstance(notes_input, list):
            return bad_request_response("Payload must contain a non-empty list of notes.")

        batch_req = BatchNoteCreateRequest(notes=notes_input)
    except (ValidationError, json.JSONDecodeError) as e:
        return bad_request_response(f"Invalid batch payload: {str(e)}")
    except Exception as e:
        return error_response(f"Internal processing error: {str(e)}")

    repo = DynamoRepository()
    all_notes = []
    all_cards = []

    for req in batch_req.notes:
        note = Note(
            user_id=user_id,
            deck_id=req.deck_id.strip().lower(),
            note_type=req.note_type,
            fields=req.fields,
            tags=req.tags or [req.deck_id.strip().lower()],
        )
        derived_cards = generate_cards_from_note(note)
        all_notes.append(note)
        all_cards.extend(derived_cards)

    try:
        repo.batch_save_notes_and_cards(all_notes, all_cards)
        return success_response(
            data={
                "message": f"Successfully created {len(all_notes)} notes and {len(all_cards)} derived cards.",
                "notes_created": len(all_notes),
                "cards_created": len(all_cards),
                "notes": [n.model_dump() for n in all_notes],
                "cards": [c.model_dump() for c in all_cards],
            },
            status_code=201,
        )
    except Exception as e:
        return error_response(f"Failed to batch persist notes: {str(e)}", status_code=500)
