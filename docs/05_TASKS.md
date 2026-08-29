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
---

### Fase 6: Autenticação via Amazon Cognito e Integração Multi-Tenant
- [x] **6.1. Definição do Cognito no IaC (AWS SAM)**
  - [x] Declarar `CognitoUserPool` com política de senha e verificação de e-mail.
  - [x] Declarar `CognitoUserPoolClient` para autenticação do frontend (sem client secret).
  - [x] Configurar `CognitoAuthorizer` no `HttpApi` (API Gateway v2) vinculando o User Pool Client.
  - [x] Exportar `CognitoUserPoolId`, `CognitoUserPoolClientId` e `CognitoUserPoolArn`.
- [x] **6.2. Autenticação e Configuração Dinâmica no Frontend (Next.js)**
  - [x] Expandir tela de configurações (`SettingsView`) para armazenar `userPoolId`, `userPoolClientId` e `region`.
  - [x] Implementar utilitários de autenticação no Amplify Client (`amplify-client.ts`).
  - [x] Desenvolver tela premium de Login / Cadastro / Confirmação de Código (`AuthView.tsx`).
  - [x] Enviar o token JWT real no cabeçalho `Authorization: Bearer <TOKEN>` nas requisições HTTP REST.
  - [x] Validar fluxo de autenticação e isolamento multi-tenant.

---
---

# 🚀 Roadmap das Próximas Fases de Entrega

```text
                    🧠 AI FLASHCARDS SAAS
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     📦 FASE 1:           🎯 FASE 2:        📊 FASE 3:
      CRIAÇÃO              ESTUDO           ANALYTICS
            │                 │                 │
     ├─ 10 Formas de   ├─ Daily Reps     ├─ Home / Dashboard
     │  Geração        ├─ Quiz Mode      ├─ Streak Diário
     ├─ AI Quick Start ├─ Guided Study   ├─ Cards Mastered
     └─ Review / Edit  ├─ IA Contextual  ├─ Tempo de Estudo
        Pré-Importação ├─ IA Adaptativa  └─ Gestão de Decks
                       └─ Estados SRS
```

---

## 📦 FASE 1: CRIAÇÃO (Geração e Ingestão de Flashcards)

Esta fase foca em fornecer todas as portas de entrada de conhecimento para o aplicativo, integrando IA generativa (Amazon Bedrock / LLMs) com processamentos síncronos e assíncronos.

### 1.1. Entrada Manual e Formatos Estruturados
- [x] **1.1.1. Manual Entry (Entrada Manual):** Criação manual de cartões nos formatos: Basic (Frente/Verso), Basic & Reversed, Cloze Deletion (`{{c1::texto}}`), Type Answer e Oclusão de Imagem.
- [x] **1.1.2. Import Apps (Importação JSON/CSV/Anki):** Parser para importação de decks e coleções em lote via JSON estruturado ou arquivos exportados de outros apps (Anki `.apkg`/`.csv`).
- [x] **1.1.3. External Output (Saída Externa):** Importação padronizada de prompts e outputs estruturados gerados por ferramentas externas de IA.

### 1.2. Mineração Direta de Conteúdo (Texto e Web)
- [x] **1.2.1. Paste Text (Colar Texto):** Processamento síncrono via Bedrock (Claude 3 Haiku / Llama 3) para extrair perguntas e respostas de textos de até 10 KB.
- [x] **1.2.2. Paste Link (Colar URL/Link):** Web scraper serverless que extrai o conteúdo textual de páginas web / artigos e submete ao pipeline de extração por IA.
- [x] **1.2.3. YouTube (Vídeo do YouTube):** Extração automatizada da transcrição/legendas de vídeos a partir da URL e conversão em flashcards estruturados por tópicos.

### 1.3. Processamento de Documentos e Mídias (Pipeline Assíncrono S3 + SQS)
- [x] **1.3.1. Select File (Upload de Documentos):** Fluxo de upload via S3 Presigned URL para processamento assíncrono de arquivos pesados (PDF, DOCX, PPTX).
- [x] **1.3.2. Image (Upload de Imagem):** Processamento de imagens informativas utilizando OCR ou visão computacional multimodal da IA para transformar diagramas e infográficos em cartões.
- [x] **1.3.3. Scan Doc (Escanear Documento):** Captura de documentos físicos pela câmera/mobile com pré-processamento de imagem, OCR e envio para a IA minerar.
- [x] **1.3.4. Voice Command (Comando de Voz):** Gravação de áudio do usuário com transcrição via Speech-to-Text (Amazon Transcribe / Whisper) e conversão do comando em flashcards.

### 1.4. Experiência de Criação Inteligente
- [x] **1.4.1. AI Quick Start:** Fluxo guiado simplificado onde o usuário apenas informa o objetivo de estudo (ex: *"Quero estudar Python para Engenharia de Dados"*) e a IA cria automaticamente o Deck, define tópicos, dificuldade e gera os flashcards iniciais.
- [x] **1.4.2. Interface de Revisão e Aprovação Pré-Importação:** Tela de conferência pós-geração da IA permitindo aprovar (`Approve`), editar (`Edit`), regenerar (`Regenerate`) ou descartar (`Delete`) cards antes de salvar no DynamoDB.

---

## 🎯 FASE 2: ESTUDO (Modalidades de Aprendizado e IA Adaptativa)

Esta fase contempla todos os mecanismos de retenção, modalidades ativas de estudo e tutoria contextual com Inteligência Artificial.

### 2.1. Motor de Agendamento e Sessão Diária
- [x] **2.1.1. Daily Reps (Sessão Diária Automatizada):** Fila inteligente de estudos baseada no algoritmo FSRS v4.5 que calcula automaticamente os cartões devidos do dia sem que o usuário precise escolher o que estudar.
- [x] **2.1.2. Estados dos Cartões:** Controle dinâmico do ciclo de vida de cada card: `🆕 New`, `📖 Learning`, `🔄 Review`, `❌ Difficult` e `✅ Mastered`.
- [x] **2.1.3. Save Point de Sessão:** Capacidade de salvar e retomar o progresso exato de onde o usuário parou em qualquer sessão de estudos.

### 2.2. Modalidades Interativas de Estudo
- [x] **2.2.1. Quiz Mode (Modo Quiz):** Modalidade interativa de perguntas com alternativas, digitação de resposta e classificação em tempo real (*Correct*, *Incorrect*, *Guided Study*).
- [x] **2.2.2. Guided Study (Tutor IA Interativo):** Sessão guiada onde a IA atua como tutora: apresenta conceitos, faz perguntas abertas, avalia a resposta discursiva do estudante, explica erros e aprofunda onde há dificuldade.

### 2.3. IA Contextual e Adaptativa
- [x] **2.3.1. Ações Rápidas de IA no Flashcard:** Interação direta no verso do cartão:
  - ✨ *Explain better* (Explicar de forma mais simples / com analogias).
  - 🧠 *Give an example* (Dar exemplos práticos do mundo real).
  - 🔄 *Generate another question* (Criar uma variação da pergunta).
  - 📚 *Go deeper* (Aprofundar a teoria).
  - 🎯 *Make it harder* (Aumentar o nível de complexidade).
- [x] **2.3.2. Suggestion Flashcards (Geração Adaptativa):** Motor que identifica lacunas de conhecimento com base nas notas/cards com mais repetições e erros, sugerindo novos cartões complementares para reforço.

---

## 📊 FASE 3: ANALYTICS (Métricas, Gamificação e Gestão de Decks)

Esta fase entrega a experiência de acompanhamento de desempenho, retenção a longo prazo, gamificação e controle completo da biblioteca de conhecimento.

### 3.1. Painel Principal (Home / Dashboard)
- [x] **3.1.1. Dashboard Personalizado:** Saudação dinâmica, exibição de decks em andamento, resumo de Daily Reps e atalhos rápidos.
- [x] **3.1.2. Mastered Cards Counter:** Contagem e categorização geral do acervo (ex: *Total: 1.200 | Aprendidos: 800 | Em Revisão: 250 | Difíceis: 100 | Novos: 50*).

### 3.2. Gamificação e Métricas de Consistência
- [x] **3.2.1. Sistema de Streak (Sequência de Estudos):** Contador de dias consecutivos de estudo (🔥 *Streak*), recorde pessoal e calendário de calor (heat map).
- [x] **3.2.2. Contador de Pontos e Metas Diárias:** Sistema de pontos por cartões revisados e progresso da meta diária configurada pelo usuário.

### 3.3. Analytics e Indicadores de Aprendizado
- [x] **3.3.1. Métricas de Volume:** Total de cards estudados, revisados e dominados por período (dia, semana, mês).
- [x] **3.3.2. Taxa de Acerto e Retenção (Accuracy):** Gráficos de performance, índice de memorização FSRS e identificação de assuntos com maior taxa de erro.
- [x] **3.3.3. Tempo de Estudo (Study Time):** Registro de tempo total investido, tempo médio diário e tempo médio gasto por flashcard.

### 3.4. Gestão Avançada de Decks e Biblioteca
- [x] **3.4.1. Gerenciamento Completo de Decks:** Criar, editar, duplicar, categorizar com tags, favoritar, pesquisar e excluir decks.
- [x] **3.4.2. Compartilhamento de Decks:** Exportação e compartilhamento de baralhos entre usuários.
- [x] **3.4.3. Filtros e Ordenação Inteligente:** Visualização por nível de domínio, quantidade de cards e data da próxima revisão.

### 3.5. Configurações e Customização
- [x] **3.5.1. Painel de Preferências:** Configuração de meta diária de cartões, idioma, limites de revisão e parâmetros do algoritmo FSRS.


## 🧠 AS TAREFAS ABAIXO, ANTES DE IMPLEMENTAR DEVE SER PERGUNTADO.

---

# 🚀 Backlog do Backend Serverless (AWS Lambdas, DynamoDB, Bedrock, S3, SQS & API Gateway)

```text
                               ┌─────────────────────────────┐
                               │  Frontend Next.js (Amplify) │
                               └──────────────┬──────────────┘
                                              │ (JWT Bearer Token)
                                              ▼
                               ┌─────────────────────────────┐
                               │ HTTP API Gateway v2 (Cognito│
                               └──────────────┬──────────────┘
            ┌─────────────────────────────────┼─────────────────────────────────┐
            ▼                                 ▼                                 ▼
   📦 FASE 1: CRIAÇÃO                🎯 FASE 2: ESTUDO                 📊 FASE 3: ANALYTICS
 ┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
 │ BatchCreateNotesFn   │          │ GetDueCardsFn (FSRS) │          │ GetAnalyticsSummaryFn│
 │ BedrockGenerateFn    │          │ ProcessReviewFn(FSRS)│          │ GetDecksSummaryFn    │
 │ BedrockScraperFn     │          │ BedrockAiTutorFn     │          │ ManageDeckFn         │
 │ S3PresignedUploadFn  │          │ AdaptiveSuggestFn    │          │ UserPreferencesFn    │
 │ SQS DocProcessorFn   │          │ SaveSessionPointFn   │          │ ShareDeckFn          │
 └──────────┬───────────┘          └──────────┬───────────┘          └──────────┬───────────┘
            │                                 │                                 │
            └─────────────────────────────────┼─────────────────────────────────┘
                                              ▼
                               ┌─────────────────────────────┐
                               │  DynamoDB Table (Single-Tbl)│
                               │   + S3 Bucket (Arquivos/OCR)│
                               └─────────────────────────────┘
```

---

## 📦 FASE 1: BACKEND - CRIAÇÃO (Geração e Ingestão de Flashcards)

### 1.1. Ingestão em Lote e Formatos Estruturados (Manual, CSV, Anki, JSON)
- **Lambda `BatchCreateNotesFunction` (`POST /notes/batch`)**
  - [x] **B1.1.1. Ingestão em Lote:** Criar endpoint para gravação de múltiplas notas e geração automática de cartões filhos (`NEW`, `BASIC`, `BASIC_REVERSED`, `CLOZE`).
  - [x] **B1.1.2. Cloze Parser:** Implementar extrator e validador de omissões (`{{c1::termo}}`, `{{c2::termo}}`) gerando $N$ cards ordinais independentes.
  - [x] **B1.1.3. Batch Persistence:** Estender `DynamoRepository` com `batch_save_notes_and_cards()` usando `batch_writer` do `boto3` para garantir integridade atômica com isolamento multi-tenant (`PK=USER#<id>`).
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_cloze_parser.py` (testar casos de omissões múltiplas e malformadas) e `tests/unit/test_note_models.py` (validação de schema).
    - *Testes de Integração:* `tests/integration/test_batch_create_notes.py` (com `moto` DynamoDB, validando GSI1PK e GSI1SK de todos os cartões derivados).

### 1.2. Mineração Síncrona com IA Generativa (Amazon Bedrock)
- **Lambda `AiGenerateCardsFunction` (`POST /ai/generate-cards`)**
  - [x] **B1.2.1. Conexão Bedrock Runtime:** Integrar `boto3.client('bedrock-runtime')` com modelo Claude 3 Haiku / Llama 3 70B com resposta em JSON estrito.
  - [x] **B1.2.2. Modos de Entrada:** Suporte para *AI Quick Start*, *Paste Text* (até 10 KB) e *External AI Prompts*.
  - [x] **B1.2.3. Web Scraper Serverless (`POST /ai/scrape-link`):** Parser HTTP serverless para extrair texto limpo de páginas/artigos e gerar flashcards via Bedrock.
  - [x] **B1.2.4. Transcrição YouTube (`POST /ai/youtube-transcript`):** Obtenção de transcrição/legendas de URLs do YouTube e conversão estruturada em flashcards.
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_bedrock_prompts.py` (validar conformidade do schema de saída dos prompts de IA) e `tests/unit/test_scraper.py`.
    - *Testes de Integração:* `tests/integration/test_ai_generate_handler.py` (mock de Bedrock com payloads variados).

### 1.3. Pipeline Assíncrono para Documentos e Mídias (S3 + SQS + Lambda)
- **Lambdas `GetPresignedUploadUrlFunction` + `DocumentProcessorWorkerFunction`**
  - [x] **B1.3.1. Presigned Upload URL (`POST /documents/presigned-url`):** Geração de URL temporária S3 com validação de MIME types (PDF, DOCX, Imagens PNG/JPG, Áudios MP3/WAV) e expiração de 15 min.
  - [x] **B1.3.2. Fila SQS + EventBridge S3:** Configuração da fila `DocumentProcessingQueue` (com DLQ) disparada por `s3:ObjectCreated:*`.
  - [x] **B1.3.3. Worker Multimodal / OCR:**
    - Extração de texto de PDF/DOCX.
    - OCR de imagens e documentos escaneados via Amazon Textract / Bedrock Vision.
    - Transcrição de áudios via Amazon Transcribe.
  - [x] **B1.3.4. Controle de Jobs Assíncronos:** Gravação de status do processamento (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) e lote de cards sugeridos no DynamoDB (`JOB#<job_id>`).
  - [x] **B1.3.5. Polling de Status (`GET /documents/jobs/{jobId}`):** Consulta do resultado do processamento pelo frontend.
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_s3_presigned.py` e `tests/unit/test_document_extractor.py`.
    - *Testes de Integração:* `tests/integration/test_document_pipeline.py` (simulação de upload S3 -> disparo SQS -> execução do Worker -> gravação DynamoDB com `moto`).

---

## 🎯 FASE 2: BACKEND - ESTUDO (Modalidades de Aprendizado e IA Adaptativa)

### 2.1. Fila FSRS e Sessões Diárias
- **Evolução das Lambdas `GetDueCardsFunction` e `ProcessReviewFunction`**
  - [x] **B2.1.1. Filtro por Baralho e Paginação:** Suporte a parâmetro `deck_id` e limite na rota `GET /study/due?deck_id=xyz&limit=50`.
  - [x] **B2.1.2. Transição dos 5 Estados SRS:** Atualização dinâmica dos estados `NEW`, `LEARNING`, `REVIEW`, `DIFFICULT` e `MASTERED` no FSRS v4.5.
  - [x] **B2.1.3. Histórico de Revisões:** Gravação de logs de estudo no DynamoDB (`PK=USER#<id>`, `SK=REV#<timestamp>#<card_id>`) com tempo de resposta, rating, estabilidade e dificuldade anterior/nova.
  - [x] **B2.1.4. Save Point de Sessão (`POST /study/session-savepoint`):** Salvar e retomar o progresso exato da fila ativa de estudos.
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_fsrs_engine_v45.py` (cobertura matemática completa de transições e intervalos calculados).
    - *Testes de Integração:* `tests/integration/test_study_review_flow.py` (validação de atomicidade de `UpdateItem` e escrita de logs).

### 2.2. Tutor IA, Avaliação de Respostas e Quiz Mode
- **Lambda `AiStudyTutorFunction` (`POST /study/ai-tutor`)**
  - [x] **B2.2.1. Avaliador Discursivo (`POST /study/evaluate-answer`):** Avaliação com IA da resposta aberta do aluno comparada ao gabarito, retornando score (0-100) e feedback pedagógico.
  - [x] **B2.2.2. Ações Rápidas no Cartão (`POST /study/ai-action`):** Implementar ações `explain`, `example`, `harder` e `deeper` com base no contexto da nota.
  - [x] **B2.2.3. Gerador de Distratores para Quiz (`POST /study/generate-quiz`):** Geração contextual de alternativas plausíveis incorretas para perguntas de múltipla escolha.
  - [x] **B2.2.4. Sugestão Adaptativa de Reforço (`POST /study/adaptive-suggestions`):** Identificação de cartões difíceis (*leeches*) e geração de cartões complementares para reforço.
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_ai_tutor.py` (validação de scoring e geração de alternativas).
    - *Testes de Integração:* `tests/integration/test_study_ai_handlers.py` (simulação de respostas do Bedrock com fallback heurístico).

---

## 📊 FASE 3: BACKEND - ANALYTICS (Métricas, Gamificação e Gestão de Decks)

### 3.1. Dashboard, Gamificação e Indicadores de Aprendizado
- **Lambda `GetAnalyticsSummaryFunction` (`GET /analytics/summary`)**
  - [x] **B3.1.1. Métricas de Volume Agregadas:** Total de cartões por estado (`Mastered`, `Learning`, `Review`, `Difficult`, `New`).
  - [x] **B3.1.2. Motor de Streak e Heatmap:** Cálculo de dias consecutivos de estudo e mapa de calor dos últimos 365 dias com base nos logs de revisão.
  - [x] **B3.1.3. Indicadores FSRS:** Cálculo de retenção teórica estimada ($R = 0.9^{\Delta t / S}$), acurácia real e tempo total investido.
  - [x] **B3.1.4. Identificador de Tópicos Fracos (*Weak Topics*):** Agrupamento por baralho/tag com maior taxa de erro para recomendação de estudo direcionado.
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_streak_calculator.py` (testar viradas de dia, fusos e quebra de sequência) e `tests/unit/test_fsrs_analytics.py`.
    - *Testes de Integração:* `tests/integration/test_analytics_summary_handler.py` (execução com banco preenchido garantindo RNF < 200ms).

### 3.2. Gestão Completa de Decks e Compartilhamento
- **Lambda `ManageDecksFunction` (`GET /decks`, `POST /decks`, `PUT /decks/{deckId}`, `DELETE /decks/{deckId}`)**
  - [x] **B3.2.1. Listagem Consolidada de Decks:** Agregação de estatísticas por baralho (total, devidos hoje, aprendidos, % de domínio, data da última revisão).
  - [x] **B3.2.2. CRUD e Favoritos:** Criar, editar metadados, favoritar (`is_favorite`) e excluir baralhos com suporte a deleção em lote dos cartões associados.
  - [x] **B3.2.3. Compartilhamento Multi-Tenant (`POST /decks/{deckId}/share` e `POST /decks/import-shared`):** Exportação/importação de baralhos entre diferentes usuários com código de compartilhamento único.
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_deck_exporter.py` (sanitização de chaves de usuário).
    - *Testes de Integração:* `tests/integration/test_manage_decks_handler.py` (validação de CRUD e isolamento multi-tenant).

### 3.3. Configurações de Usuário e Parâmetros FSRS
- **Lambda `UserPreferencesFunction` (`GET /user/preferences`, `PUT /user/preferences`)**
  - [x] **B3.3.1. Persistência de Preferências:** Gravação no DynamoDB (`PK=USER#<id>`, `SK=PREFERENCES`) de meta diária, idioma e parâmetros do algoritmo FSRS (retenção desejada, intervalo máximo).
  - 🧪 **Plano de Testes:**
    - *Testes Unitários:* `tests/unit/test_user_preferences_validation.py` (limites de retenção $0.7 \le r \le 0.97$).
    - *Testes de Integração:* `tests/integration/test_user_preferences_handler.py`.
