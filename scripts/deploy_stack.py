#!/usr/bin/env python3
"""
scripts/deploy_stack.py
Script de Automação de Deploy Serverless para a AWS:
1. Empacota dependências e código-fonte Python
2. Executa o deploy do CloudFormation Stack no AWS SAM
3. Obtém os IDs e endpoints gerados (API Gateway, Cognito, DynamoDB)
4. Atualiza o arquivo frontend/.env.local com os recursos reais
5. Executa o Seed inicial de dados no DynamoDB da nuvem
"""

import os
import sys
import shutil
import subprocess
import json
import boto3

REGION = "us-east-1"
STACK_NAME = "ultra-flashcards-dev"
STAGE = "dev"
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def run_command(cmd, cwd=PROJECT_ROOT):
    print(f"\n🚀 Executando: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if res.returncode != 0:
        print(f"❌ Erro na execução:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
        sys.exit(res.returncode)
    return res.stdout

def prepare_build_package():
    print("\n📦 [1/5] Preparando pacote de código e dependências...")
    build_dir = os.path.join(PROJECT_ROOT, ".build_src")
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    os.makedirs(build_dir, exist_ok=True)

    # 1. Copiar código-fonte de src/
    src_dir = os.path.join(PROJECT_ROOT, "src")
    for item in os.listdir(src_dir):
        s = os.path.join(src_dir, item)
        d = os.path.join(build_dir, item)
        if os.path.isdir(s) and item not in ("__pycache__", ".pytest_cache"):
            shutil.copytree(s, d)
        elif os.path.isfile(s) and not item.endswith((".pyc", ".pyo")):
            shutil.copy2(s, d)

    # 2. Instalar dependências no build_dir
    req_file = os.path.join(src_dir, "requirements.txt")
    if os.path.exists(req_file):
        print("  Instalando dependências de runtime (pydantic, requests, beautifulsoup4)...")
        pip_cmd = [
            sys.executable, "-m", "pip", "install",
            "--platform", "manylinux2014_aarch64",
            "--target", build_dir,
            "--implementation", "cp",
            "--python-version", "3.12",
            "--only-binary=:all:",
            "--upgrade",
            "-r", req_file
        ]
        run_command(pip_cmd)

    print("  ✓ Pacote de Lambda preparado com sucesso.")
    return build_dir

def package_and_deploy():
    print(f"\n☁️ [2/5] Empacotando e enviando para o S3 da AWS ({REGION})...")
    
    # Criar template temporário apontando CodeUri para .build_src
    template_path = os.path.join(PROJECT_ROOT, "infra", "template.yaml")
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Garantir que o CodeUri aponte para .build_src
    custom_template = content.replace("CodeUri: ../src/", "CodeUri: ../.build_src/")
    custom_template_path = os.path.join(PROJECT_ROOT, "infra", "template_build.yaml")
    with open(custom_template_path, "w", encoding="utf-8") as f:
        f.write(custom_template)

    packaged_template_path = os.path.join(PROJECT_ROOT, "packaged.yaml")
    
    sam_bin = os.path.join(PROJECT_ROOT, ".venv", "bin", "sam")
    if not os.path.exists(sam_bin):
        sam_bin = "sam"

    package_cmd = [
        sam_bin, "package",
        "--template-file", custom_template_path,
        "--output-template-file", packaged_template_path,
        "--resolve-s3",
        "--region", REGION
    ]
    run_command(package_cmd)

    print(f"\n🚀 [3/5] Executando CloudFormation Deploy do Stack '{STACK_NAME}'...")
    deploy_cmd = [
        sam_bin, "deploy",
        "--template-file", packaged_template_path,
        "--stack-name", STACK_NAME,
        "--capabilities", "CAPABILITY_IAM", "CAPABILITY_AUTO_EXPAND",
        "--parameter-overrides", f"Stage={STAGE}",
        "--region", REGION,
        "--no-confirm-changeset",
        "--no-fail-on-empty-changeset"
    ]
    stdout = run_command(deploy_cmd)
    print(stdout)

def retrieve_stack_outputs():
    print(f"\n🔎 [4/5] Obtendo recursos criados no CloudFormation...")
    cf = boto3.client("cloudformation", region_name=REGION)
    stacks = cf.describe_stacks(StackName=STACK_NAME)
    outputs = stacks["Stacks"][0].get("Outputs", [])

    out_map = {o["OutputKey"]: o["OutputValue"] for o in outputs}
    print("Recursos provisionados com sucesso:")
    for k, v in out_map.items():
        print(f"  • {k}: {v}")

    # Atualizar frontend/.env.local
    env_local_path = os.path.join(PROJECT_ROOT, "frontend", ".env.local")
    api_url = out_map.get("HttpApiUrl", "").rstrip("/")
    user_pool_id = out_map.get("CognitoUserPoolId", "")
    client_id = out_map.get("CognitoUserPoolClientId", "")

    env_content = f"""# Ultra Flashcards - AWS Cloud Native Config (Auto-Generated)
NEXT_PUBLIC_API_URL={api_url}
NEXT_PUBLIC_COGNITO_USER_POOL_ID={user_pool_id}
NEXT_PUBLIC_COGNITO_CLIENT_ID={client_id}
NEXT_PUBLIC_AWS_REGION={REGION}
"""
    with open(env_local_path, "w", encoding="utf-8") as f:
        f.write(env_content)

    print(f"\n  ✓ Arquivo 'frontend/.env.local' atualizado com as credenciais da AWS!")
    return out_map

def run_seed():
    print(f"\n🌱 [5/5] Populando tabela DynamoDB 'AnkiSaaS-{STAGE}' na AWS...")
    seed_script = os.path.join(PROJECT_ROOT, "scripts", "seed_dynamodb.py")
    run_command([sys.executable, seed_script, "--table", f"AnkiSaaS-{STAGE}", "--region", REGION])

if __name__ == "__main__":
    prepare_build_package()
    package_and_deploy()
    outputs = retrieve_stack_outputs()
    run_seed()
    print("\n🎉 Deploy e Seed na AWS concluídos com 100% de sucesso!")
