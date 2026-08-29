# 08 - Especificação de Produto e UX (Product & UX Blueprint)

Este documento define a visão de produto, a arquitetura de informação, o design system e a experiência do usuário (UX) para o **Ultra Flashcards SaaS**.

---

## 🔄 1. O Loop Principal do Produto

O aplicativo foi desenhado ao redor de um ciclo virtuoso contínuo de aprendizado adaptativo:

```text
             ┌────────────────────────┐
             │        1. HOME         │
             └───────────┬────────────┘
                         │
                         ▼
                "O que estudar agora?"
                         │
                         ▼
             ┌────────────────────────┐
             │        2. STUDY        │
             └───────────┬────────────┘
                         │
                    Desempenho
                         │
                         ▼
             ┌────────────────────────┐
             │      3. ANALYTICS      │
             └───────────┬────────────┘
                         │
                   IA identifica
                   pontos fracos
                         │
                         ▼
             ┌────────────────────────┐
             │   4. RECOMMENDATION    │
             └───────────┬────────────┘
                         │
                         ▼
                   Volta ao STUDY

        Enquanto isso, a biblioteca organiza o acervo:
                     DECKS
                       │
           ┌───────────┼───────────┐
           ▼           ▼           ▼
        Python      Biology       SQL
           │           │           │
           └───────────┼───────────┘
                       ▼
                     STUDY
```

---

## 🧭 2. Estrutura de Navegação Global

Navegação desktop via **Sidebar lateral** e mobile via menu drawer responsivo:

```text
┌──────────────────┬──────────────────────────────────────────┐
│                  │                                          │
│  🧠 FlashAI      │                                          │
│                  │                                          │
│  🏠 Home         │              ÁREA DE CONTEÚDO            │
│                  │                                          │
│  📚 Decks        │                                          │
│                  │                                          │
│  🧠 Study        │                                          │
│                  │                                          │
│  📊 Analytics    │                                          │
│                  │                                          │
│  ─────────────   │                                          │
│  ⚙ Settings     │                                          │
│  👤 Profile      │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

* **🏠 Home:** Decisão rápida de estudo, progresso do dia, Quick Start e recomendações da IA.
* **📚 Decks:** Biblioteca completa de conteúdos, pastas, filtros e gestão de cartões.
* **🧠 Study:** Ambiente de estudo imersivo, limpo e focado, com assistência contextual de IA.
* **📊 Analytics:** Painel de retenção real, consistência (Streak), tempo investido e pontos fracos.
* **✨ Create / AI Generator:** Hub de criação e ingestão multimodal de flashcards.
* **⚙ Settings:** Configurações de API, parâmetros FSRS e preferências da conta.

---

## 📱 3. As 4 Interfaces Principais (+ Hub de Criação)

### 🏠 1. HOME — "O que estudar agora"
* **Objetivo:** Centro de comando para direcionamento imediato do estudante sem atrito.
* **Componentes Principais:**
  1. **Header com Saudação:** Saudação personalizada com base no horário (ex: *"Good evening, José 👋"*), indicador de sequência diária (🔥 *12 days streak*) e notificações.
  2. **Daily Study Card (Principal):** Resumo do lote do dia (ex: *43 cards | ~18 min*) com botão de ação rápida `[ Start Studying ]`.
  3. **Progress Overview:** Indicador visual de domínio geral (ex: *68% Mastery | +8% this week*).
  4. **Continue Learning:** Lista com os 3 a 5 decks mais relevantes com barra de progresso e atalho de retomada `→ Continue`.
  5. **AI Quick Start:** Campo de texto conversacional para geração expressa de planos de estudo (ex: *"Prepare me for a Python Data Engineer interview"*).
  6. **Recommended for You (IA Adaptativa):** Recomendações automáticas focadas em conteúdos onde o usuário teve dificuldades recentes (ex: *"You struggled with JOINs yesterday. Practice: SQL Advanced JOINs [Study 12 cards]"*).

---

### 📚 2. DECKS — "Onde estão seus conteúdos"
* **Objetivo:** Biblioteca central de organização do conhecimento.
* **Componentes Principais:**
  1. **Barra de Controle:** Campo de busca, ordenação (*Recent*, *Mastery*, *Title*) e filtros (*All*, *In Progress*, *Completed*, *Favorites*).
  2. **Grid de Decks:** Cards visuais com ícone representativo, título, total de cartões, barra de progresso de retenção percentual e botão direto `[ Study ]`.
  3. **Página de Detalhe do Deck:** Visão aprofundada ao clicar em um deck:
     * Cabeçalho com estatísticas de retenção e botões de ação (`[ Start Study ]`, `[ + Add Cards ]`, `[ ✨ AI Generate ]`).
     * Abas de navegação interna: *Overview*, *Cards*, *Progress*, *Settings*.
     * Distribuição de status FSRS: *Due Today*, *New*, *Learning*, *Mastered*.

---

### 🧠 3. STUDY — "Experiência de aprendizado focada"
* **Objetivo:** Interface minimalista, sem distrações e com foco total na memorização ativa.
* **4 Modos de Estudo:**
  1. **Review (FSRS Tradicional):** Pergunta → Raciocínio → Revelar Resposta → Classificação (*Again*, *Hard*, *Good*, *Easy*).
  2. **Quiz Mode:** Questões interativas com alternativas de múltipla escolha e feedback imediato.
  3. **Written Answer (Resposta Escrita):** O estudante digita a resposta e a IA avalia o nível de precisão percentual (*ex: 87% correct: Você entendeu o conceito principal, mas faltou...*).
  4. **Guided Study (Tutor IA):** Sessão interativa onde a IA conduz o aprendizado com perguntas socráticas, avaliação em tempo real e explicações graduais.
* **Ações Rápidas de IA no Flashcard (Verso):**
  * ✨ *Explain differently / better* (Explicar com analogias simples).
  * 🧠 *Give me an example* (Exemplo prático do mundo real).
  * 🔄 *Create another / similar question* (Variação para reforço).
  * 📚 *Go deeper* (Aprofundar detalhes técnicos).
  * 🎯 *Make it easier / harder* (Ajustar a complexidade).

---

### 📊 4. ANALYTICS — "Como estou evoluindo"
* **Objetivo:** Responder com clareza: *"Estou realmente retendo o conteúdo a longo prazo?"*.
* **Componentes Principais:**
  1. **Cards de Resumo Global:** `% Mastery`, `Total Cards`, `Total Study Time` e `🔥 Streak`.
  2. **Gráfico de Evolução de Aprendizado (Learning Progress):** Curva temporal de retenção e acúmulo de cartões dominados.
  3. **Distribuição de Performance:** Percentual de acertos/erros e gráfico de barras das avaliações FSRS (*Easy*, *Good*, *Hard*, *Again*).
  4. **Atividade Semanal (Study Activity):** Gráfico de consistência diária por dia da semana.
  5. **Tópicos Fracos (Weak Topics):** Lista dos conceitos com menor percentual de retenção e acerto (ex: *⚠ SQL JOINs: 42%*), fechando o ciclo com o botão `[ Start Recommended Study ]`.

---

### ✨ 5. CREATE / AI GENERATOR — "Hub de Ingestão Multimodal"
* **Objetivo:** Transformar qualquer fonte de conteúdo em flashcards em segundos.
* **10 Fontes de Ingestão Suportadas:**
  1. 📝 **Paste Text:** Texto direto (processamento síncrono via Bedrock).
  2. 📄 **Select File:** Arquivos PDF, DOCX, PPTX (upload via S3 Presigned URL + SQS assíncrono).
  3. 🔗 **Paste Link:** URL de artigos e documentações web com scraping automatizado.
  4. ▶️ **YouTube:** URL de vídeos com extração de transcrição e geração de cartões.
  5. 🖼️ **Image:** Diagramas, infográficos e prints via visão multimodal.
  6. 📷 **Scan Doc:** Captura de livros e anotações físicas via câmera/mobile.
  7. 🎙️ **Voice Command:** Instruções faladas via Speech-to-Text.
  8. ✏️ **Manual Entry:** Q&A manual (Basic, Reversed, Cloze `{{c1::...}}`, Type Answer).
  9. 🤖 **External Output:** Importação de formatos estruturados de IAs externas.
  10. **{} Import Apps:** Importação de coleções via JSON, CSV e Anki `.apkg`.
* **Fluxo de Aprovação:**
  `Fonte` → `Processamento IA` → `Preview com Edição/Aprovação` → `Salvar no Deck` → `Study`.

---

## 🎨 4. Design System & Identidade Visual

* **Tema Visual:** Clean, moderno, com bastante respiro (whitespace), cantos arredondados (`rounded-2xl` / `rounded-3xl`) e sombras sutis.
* **Paleta de Cores:**
  * **Cor Primária / IA:** Roxo / Violeta vibrante (`#8b5cf6` / `#7c3aed`) representando Inteligência Artificial, conhecimento e inovação.
  * **Fundo da Aplicação:** Tons suaves e confortáveis para leitura prolongada.
  * **Cores Semânticas:**
    * 🟢 **Verde (`#22c55e`):** Mastered / Correto / Easy.
    * 🔵 **Azul (`#3b82f6`):** Good / Aprendizado ativo.
    * 🟠 **Amarelo / Laranja (`#f59e0b`):** Hard / Atenção.
    * 🔴 **Vermelho (`#ef4444`):** Again / Erro / Ponto fraco.
    * 🟣 **Roxo (`#8b5cf6`):** Ações de IA e Quick Start.
    * ⚪ **Cinza neutro:** Textos secundários, bordas e cards estruturais.
