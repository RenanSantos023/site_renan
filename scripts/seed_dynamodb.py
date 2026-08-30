"""
Script to seed DynamoDB table with initial sample data for Ultra Flashcards.
Can be executed against AWS DynamoDB or local DynamoDB instances.
"""

from datetime import datetime, timezone, timedelta
import os
import sys
import boto3

# Add src to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src'))

from domain.models import (
    DeckMetadata,
    Note,
    Card,
    NoteType,
    CardState,
    UserPreferences,
)
from repositories.dynamo_repository import DynamoRepository


def seed_database(table_name: str = "AnkiSaaS-dev", user_id: str = "usr_dev_default", dynamodb_resource = None):
    print(f"🌱 Populando tabela DynamoDB '{table_name}' para o usuário '{user_id}'...")
    
    if dynamodb_resource is None:
        dynamodb_resource = boto3.resource("dynamodb", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
        
    repo = DynamoRepository(table_name=table_name, dynamodb_resource=dynamodb_resource)
    now = datetime.now(timezone.utc)

    # 1. User Preferences
    prefs = UserPreferences(
        user_id=user_id,
        display_name="José",
        email="jose@ultraflashcards.io",
        daily_goal=30,
        desired_retention=0.90,
        max_interval_days=36500,
        language="pt-BR",
        updated_at=now.isoformat()
    )
    repo.save_user_preferences(prefs)
    print("  ✓ Preferências do usuário salvas")

    # 2. Decks
    decks = [
        DeckMetadata(
            user_id=user_id,
            deck_id="vocabulario",
            title="Vocabulário de Inglês",
            description="Termos avançados e vocabulário corporativo para conversação",
            icon="BookOpen",
            color="#8b5cf6",
            category="Idiomas",
            is_favorite=True,
            total_notes=4,
            total_cards=4,
            created_at=(now - timedelta(days=10)).isoformat(),
            updated_at=now.isoformat()
        ),
        DeckMetadata(
            user_id=user_id,
            deck_id="databricks",
            title="Databricks & Lakehouse",
            description="Arquitetura Medallion, Spark, Delta Lake e Engenharia de Dados",
            icon="Code",
            color="#3b82f6",
            category="Tecnologia",
            is_favorite=True,
            total_notes=3,
            total_cards=3,
            created_at=(now - timedelta(days=8)).isoformat(),
            updated_at=now.isoformat()
        ),
        DeckMetadata(
            user_id=user_id,
            deck_id="enem",
            title="Biologia & Citologia",
            description="Organelas celulares, metabolismo energético e divisão celular",
            icon="Brain",
            color="#22c55e",
            category="Ciências",
            is_favorite=False,
            total_notes=3,
            total_cards=3,
            created_at=(now - timedelta(days=5)).isoformat(),
            updated_at=now.isoformat()
        )
    ]
    for d in decks:
        repo.save_deck_metadata(d)
    print(f"  ✓ {len(decks)} Baralhos salvos")

    # 3. Notes & Cards
    sample_notes = [
        # Vocabulário
        Note(
            user_id=user_id,
            note_id="not_voc_1",
            deck_id="vocabulario",
            note_type=NoteType.BASIC,
            fields={"Front": "Ephemeral", "Back": "Efêmero / Transitório / De curta duração"},
            tags=["ingles", "adjetivos"],
            created_at=(now - timedelta(days=5)).isoformat()
        ),
        Note(
            user_id=user_id,
            note_id="not_voc_2",
            deck_id="vocabulario",
            note_type=NoteType.BASIC,
            fields={"Front": "Pernicious", "Back": "Pernicioso / Nocivo / Que causa dano gradual"},
            tags=["ingles", "avancado"],
            created_at=(now - timedelta(days=4)).isoformat()
        ),
        Note(
            user_id=user_id,
            note_id="not_voc_3",
            deck_id="vocabulario",
            note_type=NoteType.BASIC,
            fields={"Front": "Ubiquitous", "Back": "Onipresente / Encontrado em toda parte"},
            tags=["ingles", "vocabulario"],
            created_at=(now - timedelta(days=3)).isoformat()
        ),
        Note(
            user_id=user_id,
            note_id="not_voc_4",
            deck_id="vocabulario",
            note_type=NoteType.BASIC,
            fields={"Front": "Serendipity", "Back": "Serendipidade / Descoberta afortunada por acaso"},
            tags=["ingles", "substantivos"],
            created_at=(now - timedelta(days=2)).isoformat()
        ),

        # Databricks
        Note(
            user_id=user_id,
            note_id="not_data_1",
            deck_id="databricks",
            note_type=NoteType.BASIC,
            fields={"Front": "Medallion Architecture", "Back": "Padrão de organização em camadas (Bronze -> Silver -> Gold) para refinar progressivamente a qualidade dos dados no Lakehouse."},
            tags=["databricks", "arquitetura", "lakehouse"],
            created_at=(now - timedelta(days=7)).isoformat()
        ),
        Note(
            user_id=user_id,
            note_id="not_data_2",
            deck_id="databricks",
            note_type=NoteType.BASIC,
            fields={"Front": "Delta Lake ACID Transactions", "Back": "Garante atomicidade, consistência, isolamento e durabilidade em operações de leitura e escrita através do log de transações `_delta_log`."},
            tags=["databricks", "delta-lake"],
            created_at=(now - timedelta(days=6)).isoformat()
        ),
        Note(
            user_id=user_id,
            note_id="not_data_3",
            deck_id="databricks",
            note_type=NoteType.BASIC,
            fields={"Front": "Broadcast Hash Join", "Back": "Estratégia de otimização de join no Spark que envia a tabela menor inteira para todos os executores, eliminando o shuffle da tabela maior."},
            tags=["databricks", "spark", "performance"],
            created_at=(now - timedelta(days=4)).isoformat()
        ),

        # Biologia
        Note(
            user_id=user_id,
            note_id="not_bio_1",
            deck_id="enem",
            note_type=NoteType.BASIC,
            fields={"Front": "Mitocôndria", "Back": "Organela responsável pela respiração celular aeróbica e produção de ATP via fosforilação oxidativa."},
            tags=["biologia", "citologia", "organelas"],
            created_at=(now - timedelta(days=6)).isoformat()
        ),
        Note(
            user_id=user_id,
            note_id="not_bio_2",
            deck_id="enem",
            note_type=NoteType.BASIC,
            fields={"Front": "Ribossomos", "Back": "Complexos de RNA ribossômico e proteínas encarregados da síntese proteica (tradução do RNA mensageiro)."},
            tags=["biologia", "citologia"],
            created_at=(now - timedelta(days=5)).isoformat()
        ),
        Note(
            user_id=user_id,
            note_id="not_bio_3",
            deck_id="enem",
            note_type=NoteType.BASIC,
            fields={"Front": "Complexo de Golgi", "Back": "Organela que modifica, empacota e secreta proteínas e lipídios em vesículas transportadoras."},
            tags=["biologia", "citologia"],
            created_at=(now - timedelta(days=3)).isoformat()
        )
    ]

    sample_cards = [
        # Cards com status FSRS variados (Due Today, Review, Learning, Mastered)
        Card(user_id=user_id, card_id="crd_voc_1", note_id="not_voc_1", deck_id="vocabulario", card_ordinal=0, state=CardState.REVIEW, stability=4.5, difficulty=4.2, scheduled_days=5, due_date=(now - timedelta(hours=2)).isoformat()),
        Card(user_id=user_id, card_id="crd_voc_2", note_id="not_voc_2", deck_id="vocabulario", card_ordinal=0, state=CardState.NEW, stability=0.0, difficulty=0.0, scheduled_days=0, due_date=now.isoformat()),
        Card(user_id=user_id, card_id="crd_voc_3", note_id="not_voc_3", deck_id="vocabulario", card_ordinal=0, state=CardState.MASTERED, stability=24.0, difficulty=3.1, scheduled_days=30, due_date=(now + timedelta(days=12)).isoformat()),
        Card(user_id=user_id, card_id="crd_voc_4", note_id="not_voc_4", deck_id="vocabulario", card_ordinal=0, state=CardState.LEARNING, stability=1.8, difficulty=6.2, scheduled_days=2, due_date=now.isoformat()),

        Card(user_id=user_id, card_id="crd_data_1", note_id="not_data_1", deck_id="databricks", card_ordinal=0, state=CardState.MASTERED, stability=35.0, difficulty=2.8, scheduled_days=45, due_date=(now + timedelta(days=20)).isoformat()),
        Card(user_id=user_id, card_id="crd_data_2", note_id="not_data_2", deck_id="databricks", card_ordinal=0, state=CardState.REVIEW, stability=8.2, difficulty=5.1, scheduled_days=9, due_date=(now - timedelta(hours=5)).isoformat()),
        Card(user_id=user_id, card_id="crd_data_3", note_id="not_data_3", deck_id="databricks", card_ordinal=0, state=CardState.LEARNING, stability=2.0, difficulty=7.8, scheduled_days=2, due_date=now.isoformat()),

        Card(user_id=user_id, card_id="crd_bio_1", note_id="not_bio_1", deck_id="enem", card_ordinal=0, state=CardState.MASTERED, stability=28.0, difficulty=3.0, scheduled_days=32, due_date=(now + timedelta(days=15)).isoformat()),
        Card(user_id=user_id, card_id="crd_bio_2", note_id="not_bio_2", deck_id="enem", card_ordinal=0, state=CardState.REVIEW, stability=6.0, difficulty=4.5, scheduled_days=7, due_date=(now - timedelta(hours=1)).isoformat()),
        Card(user_id=user_id, card_id="crd_bio_3", note_id="not_bio_3", deck_id="enem", card_ordinal=0, state=CardState.NEW, stability=0.0, difficulty=0.0, scheduled_days=0, due_date=now.isoformat())
    ]

    for n in sample_notes:
        repo.save_note(n)
    for c in sample_cards:
        repo.save_card(c)
    print(f"  ✓ {len(sample_notes)} Notas e {len(sample_cards)} Flashcards salvos")

    # 4. Histórico de Revisões (Study Logs) nos últimos 7 dias para Streak e Analytics
    for day_offset in range(7, -1, -1):
        log_date = now - timedelta(days=day_offset, hours=2)
        repo.save_review_log(
            user_id=user_id,
            card_id="crd_voc_1",
            log_data={
                "rating": 3,
                "study_mode": "REVIEW",
                "deck_id": "vocabulario",
                "review_time_ms": 1400,
                "timestamp": log_date.isoformat()
            }
        )
        repo.save_review_log(
            user_id=user_id,
            card_id="crd_data_1",
            log_data={
                "rating": 4,
                "study_mode": "REVIEW",
                "deck_id": "databricks",
                "review_time_ms": 1100,
                "timestamp": (log_date + timedelta(minutes=5)).isoformat()
            }
        )
        repo.save_review_log(
            user_id=user_id,
            card_id="crd_bio_1",
            log_data={
                "rating": 3,
                "study_mode": "REVIEW",
                "deck_id": "enem",
                "review_time_ms": 1600,
                "timestamp": (log_date + timedelta(minutes=10)).isoformat()
            }
        )

    print("  ✓ Histórico de revisões gerado (Streak ativo de 8 dias)")
    print("✨ Base de dados populada com sucesso!\n")


if __name__ == "__main__":
    table = os.environ.get("TABLE_NAME", "AnkiSaaS-dev")
    user = os.environ.get("USER_ID", "usr_dev_default")
    seed_database(table_name=table, user_id=user)
