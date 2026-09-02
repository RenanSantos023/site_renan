# SPEC — Criar Novo Baralho (Deck)

## 1. Objetivo

Permitir que o usuário autenticado crie um novo baralho de flashcards informando apenas os dados essenciais para sua identificação.

A criação do baralho deve ser uma operação rápida e independente da criação dos flashcards.

Após a criação bem-sucedida, o usuário será direcionado para a página do novo baralho, onde poderá adicionar conteúdo manualmente, gerar cards com IA ou importar conteúdo.

---

# 2. Escopo

### Incluído

* Botão `+ Novo baralho`.
* Modal de criação.
* Campo de nome.
* Campo de descrição opcional.
* Validação no frontend.
* Validação no backend.
* Estado de loading.
* Tratamento de erros.
* Criação persistente no DynamoDB.
* Associação do deck ao usuário autenticado.
* Redirecionamento para o deck criado.
* Proteção contra criação de deck para outro usuário.
* Testes unitários, integração e E2E.

### Fora do escopo

Não fazem parte desta feature:

* Criação de flashcards.
* Geração de cards por IA.
* Importação de arquivos.
* Compartilhamento de decks.
* Deck público.
* Tags.
* Categorias.
* Configurações de repetição espaçada.
* Configurações avançadas de estudo.
* Upload de capa/ícone.

Essas funcionalidades poderão ser adicionadas posteriormente.

---

# 3. Fluxo principal

```text
Usuário
   │
   ▼
[+ Novo baralho]
   │
   ▼
┌─────────────────────────────┐
│ Criar novo baralho       X   │
│                             │
│ Nome *                      │
│ [_________________________] │
│                             │
│ Descrição                   │
│ [_________________________] │
│ [_________________________] │
│                             │
│ Cancelar    Criar baralho   │
└─────────────────────────────┘
              │
              ▼
        POST /decks
              │
       ┌──────┴──────┐
       │             │
     Sucesso        Erro
       │             │
       ▼             ▼
  /decks/{id}    Mensagem
```

---

# 4. Frontend

## 4.1 Botão "Novo baralho"

Localização:

* Página `Decks`.
* Também poderá futuramente existir na Home.

### Comportamento

Ao clicar:

```text
isCreateDeckModalOpen = true
```

O modal deve receber foco automaticamente no campo `Nome`.

### Estados

O botão deverá possuir pelo menos:

* Default
* Hover
* Focus
* Disabled
* Loading, caso aplicável

---

# 5. Modal de criação

## 5.1 Estrutura

```text
Criar novo baralho

Nome *
[________________________________]

Descrição
[________________________________]
[________________________________]

[Cancelar] [Criar baralho]
```

### Requisitos

* Modal acessível.
* Fechamento pelo `X`.
* Fechamento por `ESC`.
* Não fechar ao clicar fora enquanto houver operação de criação em andamento.
* Foco inicial no campo Nome.
* Focus trap dentro do modal.
* `aria-labelledby`.
* `aria-describedby`, quando houver mensagem contextual.
* Navegação completa via teclado.

---

# 6. Campo Nome

### Obrigatório

Sim.

### Regras

O frontend deve:

1. Remover espaços desnecessários no início/fim.
2. Validar campo vazio.
3. Validar tamanho máximo.
4. Impedir submissão enquanto inválido.

### Recomendação

```text
minLength: 1
maxLength: 100
```

O limite deve ser aplicado tanto no frontend quanto no backend.

### Exemplos válidos

```text
Inglês - Verbos Irregulares
Python
AWS Solutions Architect
Matemática
```

### Exemplos inválidos

```text
""
"    "
```

---

# 7. Campo Descrição

### Obrigatório

Não.

### Regras

```text
minLength: 0
maxLength: 500
```

Espaços nas extremidades devem ser removidos antes do envio.

Caso o campo contenha apenas espaços, tratar como vazio.

---

# 8. Validação no frontend

A validação deve acontecer antes da chamada à API.

Exemplo conceitual:

```typescript
{
  name: string;        // 1–100 caracteres
  description?: string; // até 500 caracteres
}
```

Mensagens:

### Nome vazio

> Informe um nome para o baralho.

### Nome excedendo limite

> O nome deve ter no máximo 100 caracteres.

### Descrição excedendo limite

> A descrição deve ter no máximo 500 caracteres.

A validação visual deve ocorrer próxima ao campo correspondente.

---

# 9. Submissão

Ao clicar em `Criar baralho`:

1. Validar formulário.
2. Normalizar dados.
3. Desabilitar botão.
4. Exibir estado de loading.
5. Enviar request.
6. Aguardar resposta.
7. Em sucesso, redirecionar para o deck.
8. Em erro, manter o modal aberto e permitir nova tentativa.

Durante a requisição:

```text
[Cancel]    [Criando...]
```

O usuário não deve conseguir disparar duas requisições simultâneas através da interface.

---

# 10. API

## Endpoint

```http
POST /decks
```

### Autenticação

Obrigatória.

O endpoint deve ser protegido pelo:

```text
API Gateway
    ↓
JWT Authorizer
    ↓
Lambda
```

O `userId` **não deve ser recebido pelo body como fonte de autoridade**.

A identidade deve ser obtida do JWT validado pelo API Gateway.

---

# 11. Request

```json
{
  "name": "Inglês - Verbos Irregulares",
  "description": "Vocabulário de verbos irregulares"
}
```

`description` pode ser omitido.

### Não aceitar

```json
{
  "userId": "..."
}
```

O backend deve ignorar/rejeitar qualquer tentativa de determinar o proprietário através do payload.

---

# 12. Response — sucesso

### HTTP 201

```json
{
  "id": "deck_01...",
  "name": "Inglês - Verbos Irregulares",
  "description": "Vocabulário de verbos irregulares",
  "createdAt": "2026-09-01T23:00:00Z",
  "updatedAt": "2026-09-01T23:00:00Z"
}
```

---

# 13. Response — erros

### 400 — Payload inválido

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request."
  }
}
```

Não retornar informações internas da aplicação.

### 401 — Não autenticado

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required."
  }
}
```

### 429 — Rate limit

Caso futuramente a rota seja submetida a throttling específico:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests."
  }
}
```

### 500 — Erro interno

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred."
  }
}
```

Nunca retornar stack trace ou detalhes de infraestrutura.

---

# 14. Lambda

Runtime:

```text
Python 3.12
Architecture: arm64
```

Responsabilidades:

1. Receber evento do API Gateway.
2. Obter `sub` do Cognito.
3. Validar payload.
4. Normalizar dados.
5. Gerar `deckId`.
6. Construir item DynamoDB.
7. Persistir deck.
8. Retornar response HTTP apropriado.

A Lambda não deve confiar em nenhum `userId` enviado pelo frontend.

---

# 15. DynamoDB

A arquitetura utiliza Single-Table Design.

O deck deve pertencer à partição do usuário:

```text
PK = USER#{cognito_sub}
```

Exemplo conceitual:

```text
PK = USER#abc123
SK = DECK#01J...
```

### Item

```json
{
  "PK": "USER#abc123",
  "SK": "DECK#01J...",
  "entityType": "DECK",

  "deckId": "01J...",
  "name": "Inglês - Verbos Irregulares",
  "description": "Vocabulário de verbos irregulares",

  "createdAt": "2026-09-01T23:00:00Z",
  "updatedAt": "2026-09-01T23:00:00Z"
}
```

---

# 16. Identificador do Deck

O `deckId` deve ser gerado pelo backend.

Não utilizar:

```text
nome do deck
timestamp isolado
incremento sequencial
```

Preferir um identificador único e não previsível, por exemplo:

```text
UUID/ULID
```

ULID é uma boa opção caso seja desejável manter ordenação temporal.

---

# 17. Isolamento entre usuários

Esta é uma regra crítica.

Um usuário somente pode acessar decks cuja:

```text
PK = USER#{seu_cognito_sub}
```

seja correspondente à identidade autenticada.

O frontend nunca deve ser responsável por garantir essa regra.

### Exemplo de ataque

Usuário A tenta:

```http
GET /decks/deck-do-usuario-B
```

Mesmo que conheça o ID do deck B, a Lambda deve buscar o recurso dentro da partição do usuário A.

Resultado:

```text
404 NOT_FOUND
```

ou uma resposta equivalente que não revele a existência do recurso.

---

# 18. Concorrência e duplicidade

A criação de dois decks com o mesmo nome deve ser **permitida no MVP**.

Exemplo:

```text
Python
Python
```

podem coexistir.

Não implementar unicidade por nome neste momento.

Isso evita complexidade e condições de corrida desnecessárias.

Se futuramente o produto exigir nomes únicos, será necessário definir uma estratégia específica de constraint/idempotência no DynamoDB.

---

# 19. Idempotência

O endpoint deve ser projetado considerando retries.

Uma requisição pode ser repetida por:

* retry do cliente;
* timeout;
* problemas de rede;
* retry de infraestrutura.

Para o MVP, recomenda-se avaliar suporte a:

```http
Idempotency-Key: <unique-key>
```

Caso implementado, a chave deve ser associada ao usuário e à operação.

Importante: não utilizar somente `name` como mecanismo de idempotência.

---

# 20. Navegação após criação

Após:

```http
POST /decks
```

retornar `201`, o frontend deve navegar para:

```text
/decks/{deckId}
```

A página deverá apresentar o estado de deck recém-criado.

Exemplo:

```text
Inglês - Verbos Irregulares

Nenhum card neste baralho.

[✨ Gerar cards com IA]
[+ Criar card]
[📄 Importar conteúdo]
```

A implementação desses botões pertence a outras features.

---

# 21. Tratamento de erros no frontend

## Erro de validação

Exibir erro no campo.

## Erro 401

Redirecionar para autenticação/reautenticação conforme estratégia global da aplicação.

## Erro 429

Exibir:

> Muitas tentativas. Aguarde alguns segundos e tente novamente.

## Erro 5xx

Exibir:

> Não foi possível criar o baralho. Tente novamente.

O usuário deve poder tentar novamente sem perder os dados preenchidos.

---

# 22. Cancelamento

Ao clicar em:

```text
Cancelar
```

ou:

```text
X
```

antes da submissão:

* fechar modal;
* limpar estado temporário;
* não realizar request.

Se a criação estiver em andamento:

```text
POST /decks
```

o fechamento deve ser controlado para evitar estados inconsistentes.

O resultado da requisição não deve gerar navegação inesperada caso o usuário já tenha abandonado o fluxo.

---

# 23. Observabilidade

A Lambda deve produzir logs estruturados.

Exemplo:

```json
{
  "event": "deck_created",
  "userId": "hash_or_internal_identifier",
  "deckId": "01J...",
  "timestamp": "..."
}
```

Evitar registrar:

* JWT;
* access token;
* refresh token;
* dados sensíveis desnecessários.

### Métricas importantes

Monitorar:

* quantidade de decks criados;
* erros 4xx;
* erros 5xx;
* latência da Lambda;
* throttling;
* erros do DynamoDB.

---

# 24. Segurança

### Obrigatório

* JWT Authorizer.
* Validar `sub` proveniente do token.
* Nunca confiar no `userId` do frontend.
* IAM Least Privilege.
* Lambda com acesso somente aos recursos necessários.
* Validação de payload.
* Limites de tamanho.
* Sanitização/normalização de strings.
* Não retornar informações internas em erros.

### XSS

Como o nome e descrição são dados controlados pelo usuário, o frontend deve renderizá-los utilizando mecanismos normais de escaping do React.

Não utilizar:

```text
dangerouslySetInnerHTML
```

para esses campos.

---

# 25. Testes Frontend

## Unitários

Testar:

* modal abre;
* modal fecha;
* foco inicial;
* validação do nome;
* validação da descrição;
* trim;
* limite de caracteres;
* botão disabled durante submit;
* loading;
* tratamento de erro;
* sucesso;
* navegação.

### Casos

```text
nome = ""
nome = "   "
nome = "Python"
nome = 100 caracteres
nome = 101 caracteres

description = ""
description = "   "
description = 500 caracteres
description = 501 caracteres
```

---

# 26. Testes Backend

## Unitários

Testar:

* payload válido;
* nome vazio;
* nome contendo somente espaços;
* nome acima do limite;
* descrição acima do limite;
* ausência de autenticação;
* extração correta do Cognito `sub`;
* geração de ID;
* criação correta do item DynamoDB;
* tratamento de erro do DynamoDB.

---

# 27. Testes de integração

Validar:

```text
API Gateway
   ↓
Lambda
   ↓
DynamoDB
```

Cenário:

```text
POST /decks
        ↓
201
        ↓
item criado no DynamoDB
```

Verificar também que:

```text
USER#A
```

não consegue acessar:

```text
USER#B
```

---

# 28. Testes E2E

### Cenário feliz

```text
Login
 ↓
Decks
 ↓
Novo baralho
 ↓
Preencher nome
 ↓
Preencher descrição
 ↓
Criar
 ↓
Deck criado
 ↓
Redirecionamento
```

### Cancelamento

```text
Decks
 ↓
Novo baralho
 ↓
Preencher dados
 ↓
Cancelar
 ↓
Modal fechado
 ↓
Nenhum deck criado
```

### Erro

Simular erro da API:

```text
Novo baralho
 ↓
Preencher
 ↓
Criar
 ↓
API 500
 ↓
Mensagem de erro
 ↓
Dados continuam preenchidos
 ↓
Usuário pode tentar novamente
```

---

# 29. Critérios de aceite

### CA01 — Abrir criação

**Dado** que o usuário está na página de decks
**Quando** clicar em `Novo baralho`
**Então** o modal deve ser exibido.

### CA02 — Nome obrigatório

**Dado** que o modal está aberto
**Quando** o usuário tentar criar sem nome
**Então** a criação não deve ser enviada à API.

### CA03 — Criação

**Dado** que nome válido foi informado
**Quando** clicar em `Criar baralho`
**Então** deve ser realizado `POST /decks`.

### CA04 — Ownership

**Dado** que o usuário está autenticado
**Quando** criar um deck
**Então** o deck deve ser associado ao `sub` do Cognito.

### CA05 — Sucesso

**Dado** que a API retorna `201`
**Então** o usuário deve ser direcionado para `/decks/{deckId}`.

### CA06 — Erro

**Dado** que a API retorna erro
**Então** o modal deve permanecer aberto e os dados devem ser preservados.

### CA07 — Double submit

**Dado** que uma requisição está em andamento
**Quando** o usuário clicar repetidamente no botão
**Então** somente uma operação deve ser disparada pelo frontend.

### CA08 — Isolamento

**Dado** que dois usuários possuem decks diferentes
**Quando** um usuário tentar acessar o deck do outro
**Então** o backend não deve fornecer os dados.

### CA09 — Cancelamento

**Dado** que o usuário preencheu o formulário
**Quando** clicar em cancelar
**Então** nenhum deck deve ser criado.

### CA10 — Exclusão Segura com Confirmação Textual

**Dado** que o usuário deseja excluir um baralho
**Quando** clicar no botão de excluir no card ou nos detalhes do baralho
**Então** deve abrir uma modal de confirmação exigindo a digitação da palavra "excluir".
**Quando** a palavra "excluir" for digitada e confirmada
**Então** o baralho e seus dados associados devem ser excluídos no backend (`DELETE /decks/{deckId}`) e o estado da aplicação atualizado imediatamente.

---

# 30. Exclusão Segura de Baralho (Delete Deck)

### Requisitos:
1. **Botão de Exclusão:** Presente em cada card de baralho na biblioteca e no cabeçalho do Drawer de Detalhes.
2. **Confirmação Obrigatória:** Modal de segurança exigindo que o usuário digite a palavra `"excluir"` antes de habilitar a ação destrutiva.
3. **Sincronização em Cascata:**
   - Remoção do baralho da listagem.
   - Remoção dos cartões e notas do estado central (`HomeView`, `DecksView`, `StudyView`, `Sidebar`).
   - Recalculação imediata de métricas globais e desmarcação de estudos ativos no baralho removido.
4. **Backend:** Endpoint `DELETE /decks/{deckId}` autenticado via JWT Authorizer.

---

# 31. Definition of Done

A feature está concluída:

* [x] Botão `Criar Baralho` integrado na visualização de Decks.
* [x] Modal acessível de criação implementado com focus trap e atalhos de teclado.
* [x] Campo `name` implementado com validação 1–100 caracteres.
* [x] Campo `description` implementado com validação até 500 caracteres.
* [x] Validação frontend e contadores em tempo real implementados.
* [x] API `POST /decks` implementada e integrada.
* [x] JWT Authorizer configurado no API Gateway.
* [x] Cognito `sub` utilizado como identidade de segurança única.
* [x] Item DynamoDB persistido na partição do usuário `USER#<sub_cognito>`.
* [x] Ownership e isolamento validados no backend.
* [x] Estado de Loading e prevenção contra double-submit implementados.
* [x] Tratamento de erros detalhado com preservação de dados implementado.
* [x] Redirecionamento automático e abertura do novo baralho implementados.
* [x] Modal de exclusão segura com confirmação textual ("excluir") implementado.
* [x] Exclusão em cascata em todos os componentes da aplicação implementada.
* [x] Testes unitários do backend implementados e validados (`test_create_deck_unit.py`).
* [x] Testes de integração executados com 100% de aprovação (54 testes).
* [x] Critérios de aceite validados.

