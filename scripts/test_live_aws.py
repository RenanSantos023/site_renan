#!/usr/bin/env python3
"""
scripts/test_live_aws.py
Teste End-to-End no Ambiente Real da AWS (Cognito + API Gateway + Lambdas + DynamoDB)
"""

import os
import sys
import json
import requests
import boto3

REGION = "us-east-1"
USER_POOL_ID = "us-east-1_zkieMwVZL"
CLIENT_ID = "2saujvfvt7sfg4nvsip2nliuc0"
API_URL = "https://7fumhngbbe.execute-api.us-east-1.amazonaws.com/dev"
TEST_EMAIL = "jose.tester@ultraflashcards.aws"
TEST_PASS = "UltraCards#2026Secure!"

def setup_cognito_test_user():
    print(f"\n🔐 [1/5] Autenticando com Amazon Cognito ({USER_POOL_ID})...")
    cognito = boto3.client("cognito-idp", region_name=REGION)
    
    # Criar ou redefinir usuário de teste na AWS
    try:
        cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=TEST_EMAIL,
            UserAttributes=[
                {"Name": "email", "Value": TEST_EMAIL},
                {"Name": "email_verified", "Value": "true"}
            ],
            MessageAction="SUPPRESS"
        )
        print("  ✓ Usuário de teste criado no Cognito User Pool.")
    except cognito.exceptions.UsernameExistsException:
        print("  ✓ Usuário de teste já existe no Cognito User Pool.")

    # Definir senha permanente
    cognito.admin_set_user_password(
        UserPoolId=USER_POOL_ID,
        Username=TEST_EMAIL,
        Password=TEST_PASS,
        Permanent=True
    )
    print("  ✓ Senha de acesso definida com sucesso.")

    # Autenticar e obter JWT Tokens reais
    auth_resp = cognito.initiate_auth(
        ClientId=CLIENT_ID,
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={
            "USERNAME": TEST_EMAIL,
            "PASSWORD": TEST_PASS
        }
    )
    id_token = auth_resp["AuthenticationResult"]["IdToken"]
    access_token = auth_resp["AuthenticationResult"]["AccessToken"]
    print("  ✓ Token JWT ID do Cognito obtido com sucesso!")
    return id_token

def test_api_gateway_live(id_token):
    headers = {
        "Authorization": f"Bearer {id_token}",
        "Content-Type": "application/json"
    }

    # 1. Testar GET /decks
    print(f"\n📚 [2/5] Testando GET {API_URL}/decks na AWS...")
    r = requests.get(f"{API_URL}/decks", headers=headers)
    print(f"  Status: {r.status_code}")
    print(f"  Resposta: {r.text[:200]}...")
    assert r.status_code == 200, f"Falha no endpoint /decks: {r.text}"
    decks = r.json().get("decks", [])
    print(f"  ✓ Retornados {len(decks)} baralhos da tabela DynamoDB na AWS.")

    # 2. Testar GET /study/due
    print(f"\n⏰ [3/5] Testando GET {API_URL}/study/due na AWS...")
    r = requests.get(f"{API_URL}/study/due", headers=headers)
    print(f"  Status: {r.status_code}")
    print(f"  Resposta: {r.text[:200]}...")
    assert r.status_code == 200, f"Falha no endpoint /study/due: {r.text}"
    due_data = r.json()
    print(f"  ✓ Fila de cartões devidos retornada pelo índice GSI1: {len(due_data.get('cards', []))} cards.")

    # 3. Testar POST /notes (Criação de flashcard no DynamoDB)
    print(f"\n✍️ [4/5] Testando POST {API_URL}/notes na AWS...")
    new_note_payload = {
        "deck_id": "aws-cloud",
        "note_type": "BASIC",
        "fields": {
            "Front": "Qual serviço da AWS oferece LLMs gerenciados sem servidor?",
            "Back": "Amazon Bedrock."
        },
        "tags": ["aws", "cloud", "bedrock"]
    }
    r = requests.post(f"{API_URL}/notes", headers=headers, json=new_note_payload)
    print(f"  Status: {r.status_code}")
    print(f"  Resposta: {r.text[:200]}...")
    assert r.status_code in (200, 201), f"Falha no endpoint /notes: {r.text}"
    created_card = r.json()["cards"][0]
    card_id = created_card["card_id"]
    print(f"  ✓ Nota e Flashcard '{card_id}' gravados no DynamoDB da AWS!")

    # 4. Testar POST /study/review (Algoritmo FSRS na Lambda)
    print(f"\n🧠 [5/5] Testando POST {API_URL}/study/review (FSRS Engine na Lambda)...")
    review_payload = {
        "card_id": card_id,
        "rating": 3 # Good
    }
    r = requests.post(f"{API_URL}/study/review", headers=headers, json=review_payload)
    print(f"  Status: {r.status_code}")
    print(f"  Resposta: {r.text}")
    assert r.status_code == 200, f"Falha no endpoint /study/review: {r.text}"
    review_res = r.json()
    print(f"  ✓ FSRS executado na Lambda: Novo estado={review_res.get('state')}, Próxima revisão={review_res.get('next_review')}")

    # 5. Testar GET /analytics/summary (Analytics FSRS na Lambda)
    print(f"\n📊 [5/6] Testando GET {API_URL}/analytics/summary na AWS...")
    r = requests.get(f"{API_URL}/analytics/summary", headers=headers)
    print(f"  Status: {r.status_code}")
    print(f"  Resposta: {r.text[:200]}...")
    assert r.status_code == 200, f"Falha no endpoint /analytics/summary: {r.text}"
    analytics_data = r.json()
    print(f"  ✓ Analytics retornado da AWS: Total Cards={analytics_data['summary']['total_cards']}, Streak={analytics_data['gamification']['streak_days']} dias.")

    # 6. Testar POST /study/ai-action (Tutor Inteligente de IA)
    print(f"\n🤖 [6/6] Testando POST {API_URL}/study/ai-action na AWS...")
    ai_action_payload = {
        "card_id": card_id,
        "action_type": "EXPLAIN",
        "context": {
            "front": "Qual serviço da AWS oferece LLMs gerenciados sem servidor?",
            "back": "Amazon Bedrock."
        }
    }
    r = requests.post(f"{API_URL}/study/ai-action", headers=headers, json=ai_action_payload)
    print(f"  Status: {r.status_code}")
    print(f"  Resposta: {r.text[:200]}...")
    assert r.status_code == 200, f"Falha no endpoint /study/ai-action: {r.text}"
    print(f"  ✓ Tutor de IA processou a ação com sucesso!")

if __name__ == "__main__":
    token = setup_cognito_test_user()
    test_api_gateway_live(token)
    print("\n🎉 Todos os testes e integrações na AWS (Cognito + API Gateway + Lambdas + DynamoDB + IA) foram 100% bem-sucedidos!")
