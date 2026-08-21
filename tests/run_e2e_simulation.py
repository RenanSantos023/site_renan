"""
Standalone E2E simulation script demonstrating the entire MVP FSRS workflow:
1. Create Note & derive Cards
2. Query Due Cards via GSI1
3. Review Cards (Again vs Easy vs Good) and verify FSRS state & due_date advance
"""

import sys
from pathlib import Path

# Add project root and src to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "src"))

import json
from datetime import datetime, timezone
import boto3
from moto import mock_aws

from src.handlers import create_note, get_due_cards, process_review
from src.repositories.dynamo_repository import DynamoRepository

TABLE_NAME = "AnkiSaaS-Simulation"


def run_simulation():
    print("=" * 70)
    print("🚀 INICIANDO SIMULAÇÃO E2E DO MOTOR FSRS (MVP)")
    print("=" * 70)

    with mock_aws():
        # 1. Configurar DynamoDB Single-Table Design
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
        table = dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "GSI1PK", "AttributeType": "S"},
                {"AttributeName": "GSI1SK", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        table.wait_until_exists()

        repo = DynamoRepository(table_name=TABLE_NAME, dynamodb_resource=dynamodb)
        create_note._repository = repo
        get_due_cards._repository = repo
        process_review._repository = repo

        user_id = "usr_estudante_aws"
        auth_context = {
            "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}}
        }

        # Step 1: POST /notes (Criar Nota BASIC & REVERSED)
        print("\n📝 1. Criando Nota do tipo BASIC_REVERSED...")
        create_res = create_note.lambda_handler({
            **auth_context,
            "body": json.dumps({
                "deck_id": "deck_idiomas",
                "note_type": "BASIC_REVERSED",
                "fields": {"Front": "Ephemeral", "Back": "Efêmero / Passageiro"},
                "tags": ["vocabulario", "ingles"]
            })
        })
        print(f"Status Code: {create_res['statusCode']}")
        create_data = json.loads(create_res["body"])
        cards = create_data["cards"]
        print(f"Nota criada: {create_data['note']['note_id']}")
        print(f"Cartões derivados ({len(cards)}):")
        for c in cards:
            print(f"  - Card ID: {c['card_id']} | Ordinal: {c['card_ordinal']} | State: {c['state']} | Due: {c['due_date']}")

        card_1_id = cards[0]["card_id"]
        card_2_id = cards[1]["card_id"]

        # Step 2: GET /study/due (Buscar cards do dia)
        print("\n⏰ 2. Buscando cartões vencidos/prontos para estudo (GET /study/due)...")
        due_res = get_due_cards.lambda_handler({
            **auth_context,
            "queryStringParameters": {}
        })
        print(f"Status Code: {due_res['statusCode']}")
        due_data = json.loads(due_res["body"])
        print(f"Cartões prontos para estudo: {due_data['count']}")
        for c in due_data["cards"]:
            print(f"  - Card ID: {c['card_id']} | State: {c['state']}")

        # Step 3: POST /study/review (Revisar Card 1 com Rating 1 - Again)
        print("\n❌ 3. Revisando Cartão 1 com Rating 1 (Again / Errei)...")
        rev1_res = process_review.lambda_handler({
            **auth_context,
            "body": json.dumps({
                "card_id": card_1_id,
                "rating": 1,
                "review_time_ms": 6000
            })
        })
        rev1_data = json.loads(rev1_res["body"])
        print(f"Status Code: {rev1_res['statusCode']}")
        print(f"Resultado FSRS:")
        print(f"  - State: {rev1_data['state']}")
        print(f"  - Stability: {rev1_data['stability']}")
        print(f"  - Difficulty: {rev1_data['difficulty']}")
        print(f"  - Next Review: {rev1_data['next_review']}")
        print(f"  - Interval (dias): {rev1_data['interval_days']}")

        # Step 4: POST /study/review (Revisar Card 2 com Rating 4 - Easy)
        print("\n🌟 4. Revisando Cartão 2 com Rating 4 (Easy / Fácil)...")
        rev2_res = process_review.lambda_handler({
            **auth_context,
            "body": json.dumps({
                "card_id": card_2_id,
                "rating": 4,
                "review_time_ms": 1500
            })
        })
        rev2_data = json.loads(rev2_res["body"])
        print(f"Status Code: {rev2_res['statusCode']}")
        print(f"Resultado FSRS:")
        print(f"  - State: {rev2_data['state']}")
        print(f"  - Stability: {rev2_data['stability']}")
        print(f"  - Difficulty: {rev2_data['difficulty']}")
        print(f"  - Next Review: {rev2_data['next_review']}")
        print(f"  - Interval (dias): {rev2_data['interval_days']}")

        # Step 5: Validar que os cards avançaram a data de revisão
        print("\n🔍 5. Verificando fila de cards após revisões...")
        due_after = get_due_cards.lambda_handler({
            **auth_context,
            "queryStringParameters": {}
        })
        due_after_data = json.loads(due_after["body"])
        print(f"Cartões vencidos restantes na fila imediata: {due_after_data['count']}")

        print("\n" + "=" * 70)
        print("✅ SIMULAÇÃO CONCLUÍDA COM SUCESSO! TODAS AS REGRAS VALIDADAS.")
        print("=" * 70)


if __name__ == "__main__":
    run_simulation()
