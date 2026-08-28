# 07 - Arquitetura de Pastas e Organização do Projeto

Este documento especifica a estrutura de diretórios e a divisão de responsabilidades para o repositório do SaaS (Monorepo Modular desacoplado).

---

## 1. Arvore de Diretórios

```text
saas-fsrs/
├── docs/                       # Documentação técnica e especificações (.md)
│   ├── 01_REQUIREMENTS.md
│   ├── 02_ARCHITECTURE.md
│   ├── 03_DATA_MODEL.md
│   ├── 04_API_SPEC.md
│   ├── 05_TASKS.md
│   └── 06_FSRS_ALGORITHM.md
├── infra/                      # Infraestrutura como Código (IaC)
│   ├── template.yaml           # Template AWS SAM / CloudFormation
│   └── samconfig.toml
├── src/                        # Backend e Regras de Negócio (Python)
│   ├── domain/                 # Regras puras (sem dependências externas/AWS)
│   │   ├── fsrs.py             # Algoritmo FSRS (cálculo de estabilidade/dificuldade)
│   │   └── models.py           # Schemas/Pydantic (Note, Card, Review)
│   ├── repositories/           # Camada de Banco de Dados
│   │   ├── dynamo_repository.py# Consultas Boto3 (Single-Table Design)
│   │   └── base.py             # Abstrações e interfaces
│   ├── handlers/               # Entry points das AWS Lambdas (Controllers)
│   │   ├── create_note.py
│   │   ├── get_due_cards.py
│   │   └── process_review.py
│   └── shared/                 # Utilitários reaproveitáveis
│       ├── responses.py        # Padronização de JSON de resposta do API Gateway
│       └── auth.py             # Leitura do Token JWT do Cognito
├── tests/                      # Suite de Testes
│   ├── unit/                   # Testes das equações FSRS e entidades
│   └── integration/            # Testes integrados com DynamoDB Local
├── frontend/                       # Interface Gráfica Next.js 14+ (App Router)
│   ├── amplify/                    # Recursos AWS Amplify Gen 2 (Schema e tipos)
│   ├── app/                        # Diretório principal da aplicação Next.js
│   │   ├── components/             # Componentes React (Sidebar, StudyView, etc.)
│   │   ├── amplify-client.ts       # Inicializador do Data Client e Mock fallback
│   │   ├── globals.css             # Estilos globais e customização de tema Tailwind
│   │   └── page.tsx                # Server Component para SSR
│   ├── utils/                      # Helper utilities
│   │   └── fsrsMath.ts             # Algoritmo FSRS em TypeScript
│   ├── amplify.yml                 # Pipeline de deploy e build da AWS Amplify
│   └── tsconfig.json               # Configurações TypeScript strict
├── .gitignore
├── Makefile                    # Automação de comandos (build, test, deploy)
└── requirements.txt
```

---

## 2. Divisão de Responsabilidades e Camadas

### A. Documentação (`docs/`)
Centraliza todos os arquivos `.md` contendo as especificações funcionais e técnicas (SDD) do sistema, garantindo que a arquitetura permaneça versionada juntamente com o código-fonte.

### B. Domínio Puro (`src/domain/`)
Contém o código da regra de negócio sem qualquer dependência de pacotes externos ou SDKs da AWS (`boto3`). 
* O arquivo `fsrs.py` é responsável estritamente por receber os estados atuais, executar os cálculos matemáticos do algoritmo e retornar o novo estado.
* Facilita testes unitários ultrarrápidos e isolados de infraestrutura.

### C. Repositórios (`src/repositories/`)
Isola o acesso e manipulação do banco de dados (DynamoDB Single-Table Design).
* A lógica de montar chaves `PK`/`SK`, chamar `put_item` ou `update_item` reside exclusivamente nesta camada.
* Permite trocar a tecnologia de persistência sem afetar o algoritmo do domínio nem os handlers.

### D. Handlers / Controladores (`src/handlers/`)
Pontos de entrada para cada AWS Lambda.
* **Responsabilidade única:** Parse do payload HTTP do API Gateway, validação básica dos inputs, invocação da camada de repositório/domínio e formatação da resposta JSON HTTP.

### E. Infraestrutura (`infra/`)
Contém a declaração dos recursos de nuvem (DynamoDB, Lambdas, API Gateway, IAM Roles e Cognito User Pools) utilizando AWS SAM (`template.yaml`).

### F. Interface (`frontend/`)
Web App desenvolvido em Next.js 14+ (App Router) e TypeScript strict. A aplicação utiliza o AWS Amplify Gen 2 para integrar com AWS Cognito e DynamoDB. Possui fallback offline inteligente (localStorage) e é hospedada no AWS Amplify Console com suporte a SSR e CI/CD nativo.