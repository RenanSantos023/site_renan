# 02 - Arquitetura de Infraestrutura (AWS Serverless)

## 1. Topologia de Componentes
- **Frontend Delivery:** AWS Amplify Console (hospedagem gerenciada Next.js App Router com SSR/CI-CD nativo).
- **Identity Provider:** Amazon Cognito User Pools (Tokens JWT).
- **API Gateway:** Amazon API Gateway (HTTP API v2) integrado com JWT Authorizer nativo.
- **Compute Layer:** AWS Lambda (Python 3.12, arquitetura arm64/Graviton2).
- **Database:** Amazon DynamoDB (Modo On-Demand, Single-Table Design).
- **AI Processing:** Amazon Bedrock (Claude 3 Haiku / Llama 3 8B).
- **Async Queue:** Amazon S3 + Amazon SQS + AWS Lambda Worker.

## 2. Diagrama de Fluxo (Mineração Assíncrona)

[Client] -> POST /ai/upload-url -> [Lambda] -> Retorna Presigned URL S3
[Client] -> PUT File -> [S3 Bucket] -> Event ObjectCreated -> [SQS Queue]
[SQS Queue] -> Trigger -> [Lambda Worker] -> Invoca [Bedrock] -> Grava [DynamoDB]

## 3. Políticas de Segurança e Limites
- **Throttling no API Gateway:** Máximo de 10 requisições/segundo por IP na rota de IA.
- **IAM Roles:** Princípio do menor privilégio. Lambdas possuem acesso apenas à partição `USER#<sub_cognito>` associada.