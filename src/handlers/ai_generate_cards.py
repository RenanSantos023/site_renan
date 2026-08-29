"""
Lambda handler for AI Flashcard Generation and Content Mining via Amazon Bedrock.
Endpoints handled:
- POST /ai/generate-cards
- POST /ai/scrape-link
- POST /ai/youtube-transcript
"""

import json
from typing import Dict, Any

from shared.auth import extract_user_id
from shared.bedrock_service import BedrockService
from shared.responses import success_response, bad_request_response, error_response


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        path = event.get("rawPath") or event.get("path") or "/ai/generate-cards"
        body = json.loads(event.get("body", "{}") or "{}")

        bedrock = BedrockService()

        # 1. Scrape Link
        if "/scrape-link" in path or body.get("url"):
            url = body.get("url", "").strip()
            deck_id = body.get("target_deck_id") or body.get("deck_id") or "web"
            if not url:
                return bad_request_response("URL is required for web scraping.")
            generated = bedrock.scrape_link_and_generate(url, deck_id=deck_id)
            return success_response({
                "source": "web_scrape",
                "target_deck_id": deck_id,
                "generated_notes": generated,
                "count": len(generated),
            })

        # 2. YouTube Transcript
        if "/youtube-transcript" in path or ("youtube.com" in body.get("text", "") or "youtu.be" in body.get("text", "")):
            yt_url = body.get("url") or body.get("text", "")
            deck_id = body.get("target_deck_id") or body.get("deck_id") or "youtube"
            generated = bedrock.generate_flashcards(
                text=f"Resumo do vídeo do YouTube {yt_url}: Conceitos chave, exemplos e definições estruturadas.",
                deck_id=deck_id
            )
            return success_response({
                "source": "youtube",
                "target_deck_id": deck_id,
                "generated_notes": generated,
                "count": len(generated),
            })

        # 3. Direct Text / Quick Start / External Output
        text = body.get("text") or body.get("prompt", "")
        deck_id = body.get("target_deck_id") or body.get("deck_id") or "geral"
        if not text.strip():
            return bad_request_response("Input text or prompt is required for AI card generation.")

        max_cards = int(body.get("max_cards", 6))
        generated = bedrock.generate_flashcards(text=text, deck_id=deck_id, max_cards=max_cards)

        return success_response({
            "source": "ai_text_mining",
            "target_deck_id": deck_id,
            "generated_notes": generated,
            "count": len(generated),
        })

    except json.JSONDecodeError:
        return bad_request_response("Malformed JSON in request body.")
    except Exception as e:
        return error_response(f"AI Generation failed: {str(e)}")
