## FASE 1

### Roadmap de Execução: MVP FSRS Engine

Este documento define o plano de ação focado na entrega do **MVP do Motor FSRS**, priorizando a persistência dos dados e a execução do algoritmo de repetição espaçada via serverless, deixando a conexão com a interface gráfica existente para uma etapa posterior.

---

## 📌 Escopo do MVP

* **Foco:** Modelo de Dados (DynamoDB) + Regra de Negócio/Algoritmo FSRS (Lambdas) + Contrato REST (API Gateway).
* **Fora de Escopo (Temporariamente):** Integração com o Frontend, Processamento de IA/PDF e Pipelines Assíncronos SQS.

---

## 🎯 Lista de Tarefas (Backlog do MVP)

### Fase 1: Modelagem e Infraestrutura de Dados (DynamoDB)
- [x] **1.1. Definição do IaC (Terraform / AWS SAM / CloudFormation)**
  - [x] Declarar a tabela `AnkiSaaS` em modo On-Demand (`PAY_PER_REQUEST`).
  - [x] Configurar Chave Primária: `PK` (String) e `SK` (String).
  - [x] Configurar Índice Secundário Global `GSI1`: `GSI1PK` e `GSI1SK` para listagem eficiente de cards vencidos (`DUE#<timestamp>`).
- [x] **1.2. Camada de Persistência (Repository Pattern)**
  - [x] Criar classe `DynamoRepository` em Python utilizando `boto3`.
  - [x] Implementar métodos base de gravação e consulta: `save_note()`, `save_card()`, `get_card()`, `get_due_cards()`.

---

### Fase 2: Lambdas Core do Motor FSRS
- [x] **2.1. Lambda `CreateNoteFunction`**
  - [x] Receber payload de criação de Nota (Deck, Tipo, Campos, Tags).
  - [x] Gravar a `Nota` no DynamoDB.
  - [x] Gerar os `Cartões` derivados em estado `NEW` com `stability = 0` e `difficulty = 0`.
- [x] **2.2. Lambda `GetDueCardsFunction`**
  - [x] Consultar a `GSI1` buscando cartões onde `GSI1SK <= DUE#<data_hora_atual>`.
  - [x] Retornar a lista de cartões prontos para estudo paginados (garantindo RNF < 150ms).
- [x] **2.3. Lambda `ProcessReviewFunction` (FSRS v4.5)**
  - [x] Integrar o módulo de cálculo do FSRS (`process_fsrs`).
  - [x] Receber `card_id` e `rating` (1=Again, 2=Hard, 3=Good, 4=Easy).
  - [x] Calcular novos atributos: `stability`, `difficulty`, `due_date`, `state` e `scheduled_days`.
  - [x] Executar `UpdateItem` transacional no DynamoDB atualizando os campos e movendo a `GSI1SK` para a nova data limite.

---

### Fase 3: Exposição de APIs e Validação
- [x] **3.1. Configuração do API Gateway (HTTP API v2)**
  - [x] Criar rota `POST /notes` -> Conectar à `CreateNoteFunction`.
  - [x] Criar rota `GET /study/due` -> Conectar à `GetDueCardsFunction`.
  - [x] Criar rota `POST /study/review` -> Conectar à `ProcessReviewFunction`.
- [x] **3.2. Testes Integrados (Postman / Bruno)**
  - [x] Testar fluxo completo: Criar Nota -> Buscar Cards do Dia -> Processar Revisões -> Validar avanço do `due_date`.
  - [x] Validar comportamento FSRS em notas "1 (Again)" vs "4 (Easy)".

---

