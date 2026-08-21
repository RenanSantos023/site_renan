# 04 - Especificação de APIs (REST HTTP API v2)

## Autenticação
Todas as rotas exigem o cabeçalho: `Authorization: Bearer <JWT_TOKEN>`

---

### Endpoint 1: Processar Revisão de Card
- **Método:** `POST`
- **Caminho:** `/study/review`
- **Lambda:** `ProcessReviewFunction`

#### Request Body:
```json
{
  "card_id": "crd_888",
  "rating": 3,
  "review_time_ms": 4200
}

Response Body (200 OK):
{
  "card_id": "crd_888",
  "state": "REVIEW",
  "next_review": "2026-08-25T09:30:00Z",
  "interval_days": 5
}

Endpoint 2: Mineração Síncrona via IA
Método: POST

Caminho: /ai/generate-cards

Lambda: AIGenerateCardsFunction

Request Body:

{
  "text": "The cat sat on the mat.",
  "target_deck_id": "deck_123"
}

Response Body (200 OK):

{
  "generated_notes": [
    {
      "note_type": "BASIC",
      "fields": {
        "Front": "What did the cat do?",
        "Back": "Sat on the mat"
      }
    }
  ]
}