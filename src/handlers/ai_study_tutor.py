"""
Lambda handler for AI Study Tutor, Written Answer Evaluator, Quiz Distractor Generator,
Adaptive Suggestions, and Session Savepoints.
Handles:
- POST /study/evaluate-answer
- POST /study/ai-action
- POST /study/generate-quiz
- POST /study/adaptive-suggestions
- POST /study/session-savepoint
- GET /study/session-savepoint
"""

import json
from typing import Dict, Any

from repositories.dynamo_repository import DynamoRepository
from shared.auth import extract_user_id
from shared.bedrock_service import BedrockService
from shared.responses import success_response, bad_request_response, error_response


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        user_id = extract_user_id(event)
        path = event.get("rawPath") or event.get("path") or ""
        http_method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "POST")
        body = json.loads(event.get("body", "{}") or "{}") if http_method != "GET" else {}

        repo = DynamoRepository()
        bedrock = BedrockService()

        # 1. Save / Get Session Savepoint
        if "session-savepoint" in path:
            if http_method == "POST":
                repo.save_session_savepoint(user_id=user_id, session_data=body)
                return success_response({"message": "Session savepoint updated successfully."})
            else:
                savepoint = repo.get_session_savepoint(user_id=user_id)
                return success_response({"savepoint": savepoint})

        # 2. Evaluate Written Answer (POST /study/evaluate-answer)
        if "evaluate-answer" in path or body.get("user_answer"):
            question = body.get("question", "")
            target_answer = body.get("target_answer", "")
            user_answer = body.get("user_answer", "")
            if not target_answer or not user_answer:
                return bad_request_response("target_answer and user_answer are required.")

            evaluation = bedrock.evaluate_written_answer(
                question=question,
                target_answer=target_answer,
                user_answer=user_answer,
            )
            return success_response(evaluation)

        # 3. AI Action on Card (POST /study/ai-action)
        if "ai-action" in path or body.get("action_type"):
            action_type = body.get("action_type", "explain")  # explain, example, harder, deeper
            question = body.get("question", "")
            answer = body.get("answer", "")
            explanation = bedrock.generate_ai_action(action_type=action_type, question=question, answer=answer)
            return success_response({"action_type": action_type, "response_text": explanation})

        # 4. Generate Quiz Distractors (POST /study/generate-quiz)
        if "generate-quiz" in path:
            question = body.get("question", "")
            correct_answer = body.get("correct_answer", "")
            pool = body.get("distractor_pool", [])
            options = bedrock.generate_quiz_distractors(question=question, correct_answer=correct_answer, pool=pool)
            return success_response({
                "question": question,
                "correct_answer": correct_answer,
                "options": options,
            })

        # 5. Adaptive Suggestions (POST /study/adaptive-suggestions)
        if "adaptive-suggestions" in path:
            deck_id = body.get("deck_id", "geral")
            difficult_context = body.get("difficult_concepts", "Conceitos com maior taxa de erro no aprendizado.")
            suggestions = bedrock.generate_flashcards(
                text=f"Reforço adaptativo para sanar dúvidas nos conceitos: {difficult_context}",
                deck_id=deck_id,
                max_cards=4,
            )
            return success_response({
                "deck_id": deck_id,
                "suggested_cards": suggestions,
                "count": len(suggestions),
            })

        return bad_request_response("Unsupported study tutor action.")

    except json.JSONDecodeError:
        return bad_request_response("Malformed JSON body.")
    except Exception as e:
        return error_response(f"AI Study Tutor error: {str(e)}")
