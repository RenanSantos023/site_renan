# 01 - Requisitos e Regras de Negócio

## 1. Escopo do Produto
SaaS multi-tenant para criação, gerenciamento e estudo de flashcards com repetição espaçada (estilo Anki) e extração automatizada de conteúdo via IA (LLM).

## 2. Regras de Negócio Core (RN)
- **RN-01 (Tipos de Cartão):** O sistema deve suportar os tipos: Basic, Basic & Reversed, Cloze Deletion (`{{c1::texto}}`), Type Answer e Image Occlusion.
- **RN-02 (Separação Nota x Cartão):** Uma `Nota` contém os dados brutos e pode gerar de 1 a N `Cartões` de estudo independentes.
- **RN-03 (Algoritmo de Agendamento):** O cálculo da próxima revisão deve utilizar o algoritmo FSRS (Free Spaced Repetition Scheduler), atualizando os atributos `stability`, `difficulty` e `due_date`. O arquivo docs/99_Util_FSRS.md contem a documentação do algoritmo FSRS. (leia somente se necessário)
- **RN-04 (Isolamento Multi-tenant):** Um usuário nunca pode visualizar ou alterar notas, baralhos ou cartões pertencentes a outro `user_id`.
- **RN-05 (Mineração por IA):**
  - **Texto Curto (< 10 KB):** Processamento síncrono via Bedrock.
  - **Documento Longo (PDF/Livro):** Processamento assíncrono via S3/SQS, notificando ao concluir.

## 3. Requisitos Não-Funcionais (RNF)
- **RNF-01:** O tempo de resposta para busca de cards do dia (`GET /study/due`) deve ser inferior a 150 ms.
- **RNF-02:** Operação em regime 100% Serverless com custo $0,00 quando inativo.
- **RNF-03:** Respostas de API maiores que 6 MB devem ser transferidas via S3 Presigned URL.