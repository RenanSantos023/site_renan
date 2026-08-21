"""
AWS Lambda Handler: CreateNoteFunction (POST /notes)
"""

import json
from typing import Dict, Any
from pydantic import ValidationError

from domain.models import Note, NoteCreateRequest, generate_cards_from_note
from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.responses import success_response, error_response

# Reusable repository instance across warm invocations
_repository: DynamoRepository = None


def get_repository() -> DynamoRepository:
    global _repository
    if _repository is None:
        _repository = DynamoRepository()
    return _repository


def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return error_response("Unauthorized: User ID could not be identified", status_code=401)

        raw_body = event.get("body")
        if not raw_body:
            return error_response("Missing request body", status_code=400)

        if isinstance(raw_body, str):
            try:
                body = json.loads(raw_body)
            except json.JSONDecodeError:
                return error_response("Invalid JSON body", status_code=400)
        else:
            body = raw_body

        try:
            req = NoteCreateRequest(**body)
        except ValidationError as e:
            return error_response("Validation error", status_code=400, details=e.errors())

        # Create domain Note
        note = Note(
            user_id=user_id,
            deck_id=req.deck_id,
            note_type=req.note_type,
            fields=req.fields,
            tags=req.tags,
        )

        # Generate derived Cards (RN-02: 1 to N cards in NEW state)
        cards = generate_cards_from_note(note)

        # Save to DynamoDB
        repo = get_repository()
        repo.save_note_with_cards(note, cards)

        return success_response(
            {
                "message": "Note and derived cards created successfully",
                "note": note.model_dump(),
                "cards": [c.model_dump() for c in cards],
                "cards_count": len(cards),
            },
            status_code=201,
        )

    except Exception as exc:
        return error_response(f"Internal server error: {str(exc)}", status_code=500)
