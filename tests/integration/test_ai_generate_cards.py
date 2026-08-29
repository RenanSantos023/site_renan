"""
Integration tests for AI Generate Cards handler.
"""

import json
from handlers.ai_generate_cards import lambda_handler


def test_ai_generate_cards_text_flow():
    event = {
        "headers": {"X-User-Id": "usr_ai_test"},
        "path": "/ai/generate-cards",
        "body": json.dumps({
            "text": "AWS Lambda é um serviço de computação serverless orientado a eventos. DynamoDB é um banco de dados NoSQL totalmente gerenciado.",
            "target_deck_id": "aws"
        })
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "generated_notes" in body
    assert body["target_deck_id"] == "aws"
    assert len(body["generated_notes"]) > 0


def test_ai_scrape_link_flow():
    event = {
        "headers": {"X-User-Id": "usr_ai_test"},
        "path": "/ai/scrape-link",
        "body": json.dumps({
            "url": "https://aws.amazon.com/bedrock/",
            "target_deck_id": "bedrock"
        })
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["source"] == "web_scrape"
    assert len(body["generated_notes"]) > 0
