#!/usr/bin/env python3
"""
scripts/verify_cross_layer_contracts.py
Validador Cruzado Automatizado: Modelagem DynamoDB x Handlers Lambda x REST API x Frontend TypeScript x SAM Template
"""

import os
import sys
import re
import yaml
import json
from datetime import datetime, timezone
import boto3
from moto import mock_aws

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from src.domain.models import (
    Note, NoteType, Card, CardState, StudyLog, DailyStats, UserAggregates,
    UserPreferences, DeckMetadata, ReviewRequest, AiJob, generate_cards_from_note
)
from src.repositories.dynamo_repository import DynamoRepository
from src.domain.fsrs import process_fsrs

def test_model_field_integrity():
    print("🔍 [1/4] Verificando integridade dos modelos Pydantic e chaves DynamoDB...")
    
    # 1. Nota e derivação de chaves
    note = Note(
        user_id="usr_test_123",
        note_id="not_test_1",
        deck_id="databricks",
        note_type=NoteType.BASIC,
        fields={"Front": "O que é Spark?", "Back": "Motor de processamento distribuído."},
        tags=["spark", "bigdata"]
    )
    assert DynamoRepository._user_pk(note.user_id) == "USER#usr_test_123"
    assert DynamoRepository._note_sk(note.note_id) == "NOTE#not_test_1"
    
    # 2. Cartão e derivação de GSI1
    now_iso = datetime.now(timezone.utc).isoformat()
    card = Card(
        user_id="usr_test_123",
        card_id="crd_test_1",
        note_id="not_test_1",
        deck_id="databricks",
        card_ordinal=0,
        state=CardState.NEW,
        due_date=now_iso
    )
    assert DynamoRepository._card_sk(card.card_id) == "CARD#crd_test_1"
    assert "DUE#" in DynamoRepository._due_gsi_sk(card.due_date)
    
    # 3. Baralho
    deck = DeckMetadata(
        user_id="usr_test_123",
        deck_id="databricks",
        title="Databricks & Spark",
        description="Engenharia de dados",
        total_cards=10,
        due_cards=3
    )
    assert DynamoRepository._deck_sk(deck.deck_id) == "DECK#databricks"
    
    # 4. StudyLog
    log = StudyLog(
        user_id="usr_test_123",
        card_id="crd_test_1",
        deck_id="databricks",
        rating=3,
        state=CardState.REVIEW,
        due=datetime.now(timezone.utc),
        stability=3.17,
        difficulty=5.2,
        elapsed_days=0,
        last_elapsed_days=0,
        scheduled_days=3,
        review_timestamp=datetime.now(timezone.utc)
    )
    assert DynamoRepository._user_pk(log.user_id) == "USER#usr_test_123"
    
    print("  ✓ Todas as entidades Pydantic derivam PK, SK e GSIs conforme Single-Table Design!")

def test_sam_template_routes():
    print("\n🔍 [2/4] Verificando conformidade do SAM Template (infra/template.yaml) com a API REST...")
    template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../infra/template.yaml"))
    
    with open(template_path, "r", encoding="utf-8") as f:
        template_text = f.read()
    
    # Mapeamento de rotas necessárias pelo frontend
    required_routes = [
        ("GET", "/decks"),
        ("POST", "/decks"),
        ("POST", "/notes"),
        ("POST", "/notes/batch"),
        ("GET", "/study/due"),
        ("POST", "/study/review"),
        ("POST", "/study/evaluate-answer"),
        ("POST", "/study/ai-action"),
        ("POST", "/study/generate-quiz"),
        ("POST", "/ai/generate-cards"),
        ("GET", "/analytics/summary"),
        ("GET", "/user/preferences")
    ]
    
    for method, path in required_routes:
        pattern = rf"Path:\s*{re.escape(path)}\s*[\r\n]+\s*Method:\s*{method}"
        match = re.search(pattern, template_text, re.IGNORECASE)
        if not match:
            # Alternativa: Method antes de Path
            alt_pattern = rf"Method:\s*{method}\s*[\r\n]+\s*Path:\s*{re.escape(path)}"
            match = re.search(alt_pattern, template_text, re.IGNORECASE)
        
        assert match is not None, f"Rota obrigatória '{method} {path}' não encontrada no infra/template.yaml!"
        print(f"  ✓ Rota mapeada no CloudFormation: [{method}] {path}")

def test_frontend_api_parity():
    print("\n🔍 [3/4] Verificando compatibilidade entre endpoints do Frontend (api.ts) e Backend...")
    api_ts_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/utils/api.ts"))
    with open(api_ts_path, "r", encoding="utf-8") as f:
        api_code = f.read()
        
    frontend_functions = [
        "apiFetchDecks",
        "apiCreateDeck",
        "apiDeleteDeck",
        "apiCreateNote",
        "apiCreateBatchNotes",
        "apiFetchDueCards",
        "apiSubmitReview",
        "apiEvaluateWrittenAnswer",
        "apiExecuteAiAction",
        "apiGenerateQuizOptions",
        "apiGenerateAiCards",
        "apiFetchAnalyticsSummary",
        "apiFetchUserPreferences",
        "apiUpdateUserPreferences"
    ]
    
    for fn in frontend_functions:
        assert fn in api_code, f"Função {fn} não encontrada no frontend/utils/api.ts!"
        print(f"  ✓ Cliente REST exporta: {fn}()")

@mock_aws
def test_full_lifecycle_dynamodb():
    print("\n🔍 [4/4] Executando ciclo de vida E2E em tabela DynamoDB real simulada...")
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    table_name = "AnkiSaaS-dev"
    
    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"}
        ],
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"}
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ],
        BillingMode="PAY_PER_REQUEST"
    )
    
    repo = DynamoRepository(table_name=table_name, dynamodb_resource=dynamodb)
    user_id = "usr_e2e_tester"
    
    # 1. Salvar Preferências
    pref = UserPreferences(user_id=user_id, desired_retention=0.9, daily_goal=25)
    repo.save_user_preferences(pref)
    fetched_pref = repo.get_user_preferences(user_id)
    assert fetched_pref.daily_goal == 25
    assert fetched_pref.desired_retention == 0.9
    print("  ✓ Preferências do usuário salvas e recuperadas.")
    
    # 2. Criar Deck
    deck = DeckMetadata(user_id=user_id, deck_id="biologia", title="Biologia Celular", total_cards=1)
    repo.save_deck_metadata(deck)
    decks = repo.get_decks(user_id)
    assert len(decks) == 1
    assert decks[0].deck_id == "biologia"
    print("  ✓ Baralho salvo e listado.")
    
    # 3. Criar Nota Cloze com 2 cartões derivados
    cloze_note = Note(
        user_id=user_id,
        note_id="not_bio_1",
        deck_id="biologia",
        note_type=NoteType.CLOZE,
        fields={"Front": "A {{c1::mitocôndria}} gera {{c2::ATP}}."},
        tags=["citologia", "bio"]
    )
    cards = generate_cards_from_note(cloze_note)
    assert len(cards) == 2
    repo.save_note_with_cards(cloze_note, cards)
    print("  ✓ Nota Cloze e 2 Flashcards persistidos no DynamoDB em lote.")
    
    # 4. Consultar fila de devidos via GSI1
    current_time = datetime.now(timezone.utc).isoformat()
    due_cards, _ = repo.get_due_cards(user_id=user_id, current_time_iso=current_time)
    assert len(due_cards) == 2
    print(f"  ✓ Índice GSI1 retornou {len(due_cards)} cartões devidos hoje.")
    
    # 5. Processar Revisão FSRS (Rating Good = 3)
    first_card = due_cards[0]
    fsrs_result = process_fsrs(rating=3, card=first_card.model_dump())
    updated_card = repo.update_card_fsrs_review(user_id=user_id, card_id=first_card.card_id, fsrs_result=fsrs_result)
    assert updated_card is not None
    assert updated_card.state == CardState.REVIEW
    print(f"  ✓ Revisão FSRS processada: Novo estado={updated_card.state.value}, Estabilidade={updated_card.stability:.2f}d, Próximo agendamento={updated_card.due_date}")
    
    print("\n🎉 Todos os contratos e fluxos cruzados passaram com 100% de conformidade!")

if __name__ == "__main__":
    test_model_field_integrity()
    test_sam_template_routes()
    test_frontend_api_parity()
    test_full_lifecycle_dynamodb()
