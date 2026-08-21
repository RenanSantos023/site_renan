# 03 - Modelagem do Banco de Dados (DynamoDB)

## 1. Configuração da Tabela
- **Nome da Tabela:** `AnkiSaaS`
- **Partition Key (PK):** `USER#<sub_cognito>` (String)
- **Sort Key (SK):** `<ENTITY_TYPE>#<entity_id>` (String)
- **Billing Mode:** PAY_PER_REQUEST (On-Demand)

## 2. Schemas de Entidades

### A. Nota (Note)
- **PK:** `USER#usr_123`
- **SK:** `NOTE#not_999`
- **Atributos:**
  - `deck_id` (String)
  - `note_type` (Enum: `BASIC`, `CLOZE`, etc.)
  - `fields` (Map de Strings/HTML)
  - `tags` (List de Strings)

### B. Cartão (Card)
- **PK:** `USER#usr_123`
- **SK:** `CARD#crd_888`
- **GSI1PK:** `USER#usr_123`
- **GSI1SK:** `DUE#<iso_timestamp>`
- **Atributos:**
  - `note_id` (String)
  - `card_ordinal` (Number)
  - `state` (Enum: `NEW`, `LEARNING`, `REVIEW`)
  - `stability` (Float)
  - `difficulty` (Float)
  - `due_date` (String ISO-8601)

## 3. Índices Secundários Globais (GSI)
- **Index Name:** `GSI1`
- **Partition Key (`GSI1PK`):** `USER#<sub_cognito>`
- **Sort Key (`GSI1SK`):** `DUE#<iso_timestamp>`