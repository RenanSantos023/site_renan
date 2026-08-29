"""
Unit tests for BedrockService and heuristics.
"""

from shared.bedrock_service import BedrockService


def test_heuristic_flashcard_generation():
    service = BedrockService()
    text = (
        "A fotossíntese é o processo biológico pelo qual plantas produzem energia solar. "
        "A clorofila é o pigmento responsável por absorver a luz do sol nas folhas."
    )
    cards = service.generate_flashcards(text=text, deck_id="biologia", max_cards=3)
    assert len(cards) > 0
    assert "Front" in cards[0]
    assert "Back" in cards[0]


def test_evaluate_written_answer_heuristic():
    service = BedrockService()
    target = "Mitocôndria produz energia celular através da síntese de ATP aeróbica."
    user = "A mitocôndria é responsável por gerar energia e síntese de ATP."
    result = service.evaluate_written_answer(
        question="Qual a função da mitocôndria?",
        target_answer=target,
        user_answer=user,
    )
    assert "score" in result
    assert "feedback" in result
    assert result["score"] >= 50


def test_generate_ai_actions():
    service = BedrockService()
    explain = service.generate_ai_action("explain", "O que é FSRS?", "Um algoritmo de repetição espaçada")
    assert "Explicação Simplificada" in explain

    example = service.generate_ai_action("example", "O que é FSRS?", "Um algoritmo de repetição espaçada")
    assert "Exemplo Prático" in example


def test_generate_quiz_distractors():
    service = BedrockService()
    options = service.generate_quiz_distractors(
        question="Qual é a capital da França?",
        correct_answer="Paris",
        pool=["Londres", "Berlim", "Roma", "Madrid"],
    )
    assert len(options) == 4
    assert "Paris" in options
