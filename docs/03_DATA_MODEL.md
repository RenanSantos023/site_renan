# 03 - Modelagem do Banco de Dados (DynamoDB Single-Table Design)

Este documento especifica a modelagem completa de dados para o **Ultra Flashcards SaaS**, utilizando o padrão **Single-Table Design** no Amazon DynamoDB.

---

## 1. Configuração da Tabela

- **Nome da Tabela:** `AnkiSaaS-${Stage}` (ex: `AnkiSaaS-dev`)
- **Partition Key (PK):** `PK` (String) — Formato: `USER#<user_id_cognito>`
- **Sort Key (SK):** `SK` (String) — Formato: `<ENTITY_TYPE>#<entity_id>`
- **Billing Mode:** PAY_PER_REQUEST (On-Demand)
- **Point-in-Time Recovery (PITR):** Habilitado
- **Criptografia:** AWS KMS SSE Habilitado

---

## 2. Índices Secundários Globais (GSIs)

### GSI1 — Fila de Cartões para Revisão (Due Cards Queue)
Permite buscar rapidamente todos os cartões vencidos de um usuário ordenados cronologicamente.
- **Index Name:** `GSI1`
- **Partition Key (`GSI1PK`):** `USER#<user_id>`
- **Sort Key (`GSI1SK`):** `DUE#<iso_timestamp>`
- **Projection:** `ALL`

### GSI2 — Filtragem por Deck e Estado (Deck Cards Index)
Permite listar os cartões de um deck específico e filtrar/ordenar por estado (`NEW`, `LEARNING`, `REVIEW`, `MASTERED`).
- **Index Name:** `GSI2`
- **Partition Key (`GSI2PK`):** `DECK#<deck_id>`
- **Sort Key (`GSI2SK`):** `STATE#<state>#DUE#<iso_timestamp>`
- **Projection:** `ALL`

---

## 3. Schemas das Entidades

### A. Perfil & Preferências do Usuário (`UserPreferences`)
Armazena configurações globais do algoritmo FSRS, limites diários e preferências de IA.
- **PK:** `USER#<user_id>`
- **SK:** `PROFILE`
- **Atributos:**
  - `user_id` (String)
  - `display_name` (String)
  - `email` (String)
  - `fsrs_weights` (List[Float]) — 19 pesos calibrados do FSRS v4.5
  - `desired_retention` (Float) — Padrão: `0.90` (90%)
  - `daily_new_cards_limit` (Number) — Padrão: `20`
  - `daily_review_limit` (Number) — Padrão: `100`
  - `max_interval_days` (Number) — Padrão: `36500` (100 anos)
  - `language` (String) — Padrão: `"pt-BR"`
  - `updated_at` (String ISO-8601)

---

### B. Baralho / Coleção (`Deck`)
Metadados, contadores e personalização visual dos decks.
- **PK:** `USER#<user_id>`
- **SK:** `DECK#<deck_id>`
- **Atributos:**
  - `user_id` (String)
  - `deck_id` (String) — Ex: `dck_vocabulario`
  - `title` (String)
  - `description` (String)
  - `icon` (String) — Ex: `"BookOpen"`, `"Code"`, `"Brain"`
  - `color` (String) — Ex: `"#8b5cf6"`, `"#3b82f6"`
  - `category` (String) — Ex: `"Idiomas"`, `"Tecnologia"`, `"Concursos"`
  - `is_favorite` (Boolean)
  - `total_notes` (Number)
  - `total_cards` (Number)
  - `created_at` (String ISO-8601)
  - `updated_at` (String ISO-8601)

---

### C. Nota (`Note` — Conteúdo Bruto)
Fonte da verdade do conhecimento. Contém os campos e tipo de nota.
- **PK:** `USER#<user_id>`
- **SK:** `NOTE#<note_id>`
- **Atributos:**
  - `user_id` (String)
  - `note_id` (String) — Ex: `not_a1b2c3d4e5`
  - `deck_id` (String)
  - `note_type` (Enum) — `BASIC`, `BASIC_REVERSED`, `CLOZE`, `TYPE_ANSWER`, `IMAGE_OCCLUSION`
  - `fields` (Map[String, String]) — `{ "Front": "...", "Back": "...", "Extra": "...", "Text": "..." }`
  - `tags` (List[String]) — Ex: `["python", "asyncio", "backend"]`
  - `created_at` (String ISO-8601)
  - `updated_at` (String ISO-8601)

---

### D. Cartão de Estudo (`Card` — Instância FSRS)
Instância gerada a partir da Nota com parâmetros de memória FSRS.
- **PK:** `USER#<user_id>`
- **SK:** `CARD#<card_id>`
- **GSI1PK:** `USER#<user_id>`
- **GSI1SK:** `DUE#<due_date_iso>`
- **GSI2PK:** `DECK#<deck_id>`
- **GSI2SK:** `STATE#<state>#DUE#<due_date_iso>`
- **Atributos:**
  - `user_id` (String)
  - `card_id` (String) — Ex: `crd_x1y2z3`
  - `note_id` (String)
  - `deck_id` (String)
  - `card_ordinal` (Number) — Posição (0 para front->back, 1 para cloze 2 ou back->front)
  - `state` (Enum) — `NEW` (0), `LEARNING` (1), `REVIEW` (2), `RELEARNING` (3), `MASTERED` (4)
  - `stability` (Float) — Estabilidade em dias (S)
  - `difficulty` (Float) — Dificuldade intrínseca 1 a 10 (D)
  - `elapsed_days` (Number) — Dias desde a última revisão
  - `scheduled_days` (Number) — Próximo intervalo agendado
  - `reps` (Number) — Quantidade total de revisões
  - `lapses` (Number) — Quantidade de esquecimentos (avaliação `Again`)
  - `due_date` (String ISO-8601) — Próxima data de estudo
  - `last_review_date` (String ISO-8601 ou Null)
  - `created_at` (String ISO-8601)
  - `updated_at` (String ISO-8601)

---

### E. Histórico de Revisões (`StudyLog`)
Registro imutável de cada interação de estudo nos 4 modos (Review, Quiz, Written, Tutor).
- **PK:** `USER#<user_id>`
- **SK:** `LOG#<timestamp_iso>#<card_id>`
- **Atributos:**
  - `user_id` (String)
  - `card_id` (String)
  - `note_id` (String)
  - `deck_id` (String)
  - `rating` (Number) — `1` (Again), `2` (Hard), `3` (Good), `4` (Easy)
  - `study_mode` (Enum) — `REVIEW`, `QUIZ`, `WRITTEN_ANSWER`, `GUIDED_TUTOR`
  - `review_duration_ms` (Number)
  - `stability_before` (Float)
  - `stability_after` (Float)
  - `difficulty_before` (Float)
  - `difficulty_after` (Float)
  - `ai_score_percent` (Number opcional) — Ex: `85` para resposta escrita
  - `created_at` (String ISO-8601)

---

### F. Métricas Diárias & Agregadas (`DailyStats` & `UserAggregates`)

#### 1. Estatística Diária (`DailyStats`)
- **PK:** `USER#<user_id>`
- **SK:** `STATS#DAY#<YYYY-MM-DD>`
- **Atributos:**
  - `date` (String) — `YYYY-MM-DD`
  - `cards_studied` (Number)
  - `time_spent_seconds` (Number)
  - `ratings_count` (Map) — `{ "again": 2, "hard": 5, "good": 20, "easy": 10 }`
  - `retention_rate` (Float) — `0.88`

#### 2. Agregados Globais (`UserAggregates`)
- **PK:** `USER#<user_id>`
- **SK:** `STATS#SUMMARY`
- **Atributos:**
  - `current_streak` (Number) — Dias consecutivos ativos
  - `longest_streak` (Number) — Recorde de streak
  - `last_study_date` (String) — `YYYY-MM-DD`
  - `total_cards_studied` (Number)
  - `total_time_spent_seconds` (Number)
  - `weak_topics` (List[Map]) — `[ { "tag": "SQL JOINs", "error_rate": 0.58, "card_count": 12 } ]`
  - `updated_at` (String ISO-8601)

---

### G. Tarefas de Ingestão e IA (`AiJob`)
Acompanhamento do processamento multimodal de criação de flashcards (PDF, URL, YouTube, Áudio, etc.).
- **PK:** `USER#<user_id>`
- **SK:** `JOB#<job_id>`
- **Atributos:**
  - `user_id` (String)
  - `job_id` (String) — Ex: `job_9a8b7c`
  - `deck_id` (String)
  - `source_type` (Enum) — `TEXT`, `FILE`, `URL`, `YOUTUBE`, `IMAGE`, `SCAN`, `VOICE`, `MANUAL`
  - `status` (Enum) — `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
  - `source_payload_or_key` (String) — Texto ou S3 Key do arquivo enviado
  - `generated_notes` (List[Map]) — Cartões gerados pela IA aguardando aprovação
  - `error_message` (String opcional)
  - `created_at` (String ISO-8601)
  - `completed_at` (String ISO-8601 opcional)

---

## 4. Tabela Resumo de Chaves e Padrões de Acesso

| Padrão de Acesso (Query) | Tabela / GSI | `PK` / `GSI-PK` | `SK` / `GSI-SK` |
| :--- | :--- | :--- | :--- |
| **Buscar Perfil/Preferências** | Tabela Principal | `USER#<user_id>` | `PROFILE` |
| **Listar todos os Decks do Usuário** | Tabela Principal | `USER#<user_id>` | `begins_with(DECK#)` |
| **Buscar Deck Específico** | Tabela Principal | `USER#<user_id>` | `DECK#<deck_id>` |
| **Listar todas as Notas do Usuário** | Tabela Principal | `USER#<user_id>` | `begins_with(NOTE#)` |
| **Buscar Nota Específica** | Tabela Principal | `USER#<user_id>` | `NOTE#<note_id>` |
| **Buscar Cartões Vencidos (Due Cards)** | `GSI1` | `USER#<user_id>` | `GSI1SK <= DUE#<now_iso>` |
| **Listar Cartões de um Deck por Estado**| `GSI2` | `DECK#<deck_id>` | `begins_with(STATE#<state>)` |
| **Listar Histórico de Revisões Recentes** | Tabela Principal | `USER#<user_id>` | `begins_with(LOG#)` |
| **Buscar Métricas do Dia** | Tabela Principal | `USER#<user_id>` | `STATS#DAY#<YYYY-MM-DD>` |
| **Buscar Resumo de Analytics/Streak** | Tabela Principal | `USER#<user_id>` | `STATS#SUMMARY` |
| **Consultar Status de Job da IA** | Tabela Principal | `USER#<user_id>` | `JOB#<job_id>` |