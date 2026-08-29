"""
Integration tests for Study Flow, AI Tutor, Answer Evaluation, Quiz, and Savepoints.
"""

import json
import boto3
import pytest
from moto import mock_aws

from handlers.ai_study_tutor import lambda_handler
from repositories.dynamo_repository import DynamoRepository

TABLE_NAME = "AnkiSaaS-Test"


@pytest.fixture
def setup_dynamo():
    with mock_aws():
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
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        table.wait_until_exists()
        yield dynamodb


def test_evaluate_written_answer_endpoint():
    event = {
        "headers": {"X-User-Id": "usr_study_test"},
        "path": "/study/evaluate-answer",
        "body": json.dumps({
            "question": "O que é Medallion Architecture?",
            "target_answer": "Padrão de camadas Bronze, Silver e Gold em Lakehouses.",
            "user_answer": "É a arquitetura de dados organizada em camadas Bronze, Silver e Gold."
        })
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "score" in body
    assert "feedback" in body
    assert body["score"] >= 60


def test_ai_action_endpoint():
    event = {
        "headers": {"X-User-Id": "usr_study_test"},
        "path": "/study/ai-action",
        "body": json.dumps({
            "action_type": "explain",
            "question": "O que é Decorator em Python?",
            "answer": "Uma função que recebe outra função como argumento e estende seu comportamento sem modificá-la."
        })
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["action_type"] == "explain"
    assert "response_text" in body


def test_generate_quiz_endpoint():
    event = {
        "headers": {"X-User-Id": "usr_study_test"},
        "path": "/study/generate-quiz",
        "body": json.dumps({
            "question": "Qual é a velocidade da luz?",
            "correct_answer": "299.792 km/s",
            "distractor_pool": ["150.000 km/s", "384.400 km/s", "1.080 km/h"]
        })
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["options"]) == 4
    assert "299.792 km/s" in body["options"]


def test_session_savepoint_endpoint(setup_dynamo, monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)

    # 1. Save savepoint
    post_event = {
        "headers": {"X-User-Id": "usr_study_test"},
        "path": "/study/session-savepoint",
        "httpMethod": "POST",
        "body": json.dumps({"current_card_index": 5, "deck_id": "databricks"})
    }
    res_post = lambda_handler(post_event, None)
    assert res_post["statusCode"] == 200

    # 2. Get savepoint
    get_event = {
        "headers": {"X-User-Id": "usr_study_test"},
        "path": "/study/session-savepoint",
        "httpMethod": "GET"
    }
    res_get = lambda_handler(get_event, None)
    assert res_get["statusCode"] == 200
    body = json.loads(res_get["body"])
    assert body["savepoint"]["current_card_index"] == 5
