# 04 - Especificação de APIs (REST HTTP API v2)

## Autenticação
Todas as rotas exigem autenticação via token JWT emitido pelo **Amazon Cognito**:
- **Header:** `Authorization: Bearer <JWT_ID_TOKEN>` (ou `Authorization: <JWT_ID_TOKEN>`)
- A identidade do usuário (`sub`) é extraída diretamente das *claims* validadas pelo `CognitoAuthorizer` no API Gateway.

---

## 1. Gestão de Baralhos (Decks)

### 1.1. Listar Baralhos com Métricas Consolidadas
- **Método:** `GET`
- **Caminho:** `/decks`
- **Lambda:** `ManageDecksFunction`
- **Resposta (200 OK):**
```json
{
  "decks": [
    {
      "deck_id": "deck_f12a34b5",
      "title": "Inglês Avançado",
      "description": "Vocabulário C1 e expressões idiomáticas",
      "is_favorite": true,
      "tags": ["ingles", "c1"],
      "card_count": 42,
      "due_count": 8,
      "new_count": 5,
      "learning_count": 12,
      "mastered_count": 17,
      "mastery_percent": 40,
      "latest_update": "2026-09-01T20:30:00Z"
    }
  ],
  "count": 1
}
```

### 1.2. Criar Novo Baralho
- **Método:** `POST`
- **Caminho:** `/decks`
- **Lambda:** `ManageDecksFunction`
- **Request Body:**
```json
{
  "name": "Biologia Molecular",
  "description": "Ciclo de Krebs e síntese de proteínas",
  "icon": "biotech",
  "color": "#8b5cf6"
}
```
- **Resposta (201 Created):**
```json
{
  "id": "deck_7a8b9c0d1e2f",
  "deck_id": "deck_7a8b9c0d1e2f",
  "name": "Biologia Molecular",
  "title": "Biologia Molecular",
  "description": "Ciclo de Krebs e síntese de proteínas",
  "icon": "biotech",
  "color": "#8b5cf6",
  "category": "Geral",
  "is_favorite": false,
  "tags": ["deck_7a8b9c0d1e2f"],
  "createdAt": "2026-09-01T21:00:00Z",
  "updatedAt": "2026-09-01T21:00:00Z"
}
```

### 1.3. Excluir Baralho (Deleção em Cascata)
- **Método:** `DELETE`
- **Caminho:** `/decks/{deckId}`
- **Lambda:** `ManageDecksFunction`
- **Comportamento:** Remove atomicamente o metadado do baralho (`DECK#...`), todas as notas associadas (`NOTE#...`), todos os flashcards derivados (`CARD#...`) e todos os logs de revisão (`REV#...`) no DynamoDB.
- **Resposta (200 OK):**
```json
{
  "message": "Deck 'deck_7a8b9c0d1e2f' and all associated cards removed successfully."
}
```

### 1.4. Compartilhar Baralho
- **Método:** `POST`
- **Caminho:** `/decks/{deckId}/share`
- **Lambda:** `ManageDecksFunction`
- **Resposta (200 OK):**
```json
{
  "share_code": "deck_a1b2c3d4",
  "deck_id": "deck_7a8b9c0d1e2f",
  "notes_count": 15,
  "cards_count": 18,
  "notes": [...],
  "created_at": "2026-09-01T21:15:00Z"
}
```

### 1.5. Importar Baralho Compartilhado
- **Método:** `POST`
- **Caminho:** `/decks/import-shared`
- **Lambda:** `ManageDecksFunction`
- **Request Body:**
```json
{
  "bundle": {
    "deck_id": "deck_importado",
    "notes": [...]
  },
  "title": "Baralho Importado"
}
```
- **Resposta (201 Created)**

---

## 2. Notas e Flashcards (Notes & Cards)

### 2.1. Criar Nota Individual
- **Método:** `POST`
- **Caminho:** `/notes`
- **Lambda:** `CreateNoteFunction`
- **Request Body:**
```json
{
  "deck_id": "deck_7a8b9c0d1e2f",
  "note_type": "BASIC",
  "fields": {
    "Front": "Qual a principal organela responsável pela respiração celular?",
    "Back": "Mitocôndria"
  },
  "tags": ["biologia", "celula"]
}
```
- **Resposta (201 Created):**
```json
{
  "note": {
    "note_id": "not_e1f2a3b4",
    "deck_id": "deck_7a8b9c0d1e2f",
    "note_type": "BASIC",
    "fields": { "Front": "...", "Back": "..." },
    "tags": ["biologia", "celula"],
    "created_at": "2026-09-01T21:20:00Z"
  },
  "cards": [
    {
      "card_id": "crd_98765432",
      "note_id": "not_e1f2a3b4",
      "deck_id": "deck_7a8b9c0d1e2f",
      "state": "NEW",
      "stability": 0.0,
      "difficulty": 0.0,
      "due_date": "2026-09-01T21:20:00Z"
    }
  ],
  "cards_count": 1
}
```

### 2.2. Criação de Notas em Lote
- **Método:** `POST`
- **Caminho:** `/notes/batch`
- **Lambda:** `BatchCreateNotesFunction`

---

## 3. Fila de Estudo e Algoritmo FSRS

### 3.1. Consultar Fila de Estudo / Acervo Completo
- **Método:** `GET`
- **Caminho:** `/study/due`
- **Lambda:** `GetDueCardsFunction`
- **Query Parameters:**
  - `deck_id` *(opcional)*: Filtra por baralho específico.
  - `limit` *(opcional, default 50)*: Quantidade por página.
  - `next_token` *(opcional)*: Token para paginação.
  - `all=true` *(opcional)*: Retorna **todos os cartões e notas do acervo**, ignorando a data de vencimento (útil para a Biblioteca de Decks).
- **Resposta (200 OK):**
```json
{
  "cards": [...],
  "notes": [...],
  "count": 15,
  "next_token": null,
  "timestamp": "2026-09-01T21:30:00Z"
}
```

### 3.2. Processar Avaliação de Revisão (FSRS v4.5)
- **Método:** `POST`
- **Caminho:** `/study/review`
- **Lambda:** `ProcessReviewFunction`
- **Request Body:**
```json
{
  "card_id": "crd_98765432",
  "rating": 3,
  "review_time_ms": 3500,
  "study_mode": "REVIEW"
}
```
- **Ratings FSRS:**
  - `1`: Again (Errei)
  - `2`: Hard (Difícil)
  - `3`: Good (Bom)
  - `4`: Easy (Fácil)
- **Resposta (200 OK):**
```json
{
  "card_id": "crd_98765432",
  "state": "REVIEW",
  "stability": 4.12,
  "difficulty": 5.23,
  "scheduled_days": 4,
  "due_date": "2026-09-05T21:30:00Z",
  "last_review_date": "2026-09-01T21:30:00Z"
}
```

---

## 4. Analytics e Gamificação

### 4.1. Resumo de Retenção e Métricas
- **Método:** `GET`
- **Caminho:** `/analytics/summary`
- **Lambda:** `AnalyticsSummaryFunction`
- **Resposta (200 OK):**
```json
{
  "summary": {
    "total_cards": 50,
    "mastered_cards": 20,
    "learning_cards": 10,
    "difficult_cards": 5,
    "new_cards": 5,
    "review_cards": 10,
    "mastery_percent": 40
  },
  "gamification": {
    "streak_days": 7,
    "record_streak_days": 14,
    "total_reviews": 120,
    "total_study_minutes": 45,
    "accuracy_rate": 88
  },
  "heatmap": {
    "2026-09-01": 15,
    "2026-08-31": 22
  },
  "weak_topics": [
    {
      "topic": "Inglês Avançado",
      "deck": "ingles",
      "accuracy": 62,
      "total_reviews": 35
    }
  ],
  "timestamp": "2026-09-01T21:30:00Z"
}
```

---

## 5. Preferências de Usuário

### 5.1. Consultar / Atualizar Parâmetros
- **Métodos:** `GET /user/preferences`, `PUT /user/preferences`
- **Lambda:** `UserPreferencesFunction`
- **Payload:**
```json
{
  "daily_goal": 25,
  "desired_retention": 0.90,
  "max_interval_days": 365,
  "language": "pt-BR"
}
```