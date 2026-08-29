"""
Integration tests for Document Processor & Presigned URL generation.
"""

import json
import boto3
import pytest
from moto import mock_aws

from handlers.document_processor import lambda_handler

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


def test_presigned_url_generation(setup_dynamo, monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    monkeypatch.setenv("DOCUMENTS_BUCKET", "ultra-docs-test")

    event = {
        "headers": {"X-User-Id": "usr_doc_test"},
        "path": "/documents/presigned-url",
        "httpMethod": "POST",
        "body": json.dumps({
            "file_name": "guia_python.pdf",
            "content_type": "application/pdf",
            "deck_id": "python"
        })
    }

    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "upload_url" in body
    assert "job_id" in body
    assert body["job_id"].startswith("job_")


def test_get_job_status(setup_dynamo, monkeypatch):
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)

    event = {
        "headers": {"X-User-Id": "usr_doc_test"},
        "path": "/documents/jobs/job_123456",
        "pathParameters": {"jobId": "job_123456"},
        "httpMethod": "GET"
    }

    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "job_id" in body
    assert "status" in body
