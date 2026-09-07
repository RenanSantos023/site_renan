import json
import os
import urllib.request
import urllib.error
import boto3

from datetime import datetime, timezone
from decimal import Decimal


# ==========================================================
# CONFIGURAÇÕES
# ==========================================================

ASAAS_API_URL = os.environ["ASAAS_API_URL"]
ASAAS_API_KEY = os.environ["ASAAS_API_KEY"]
TABLE_NAME = os.environ["TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


# ==========================================================
# REQUISIÇÃO PARA O ASAAS
# ==========================================================

def asaas_request(method, endpoint, data=None):

    url = f"{ASAAS_API_URL}{endpoint}"

    body = None

    if data is not None:
        body = json.dumps(data).encode("utf-8")

    request = urllib.request.Request(
        url=url,
        data=body,
        method=method
    )

    request.add_header(
        "access_token",
        ASAAS_API_KEY
    )

    request.add_header(
        "Content-Type",
        "application/json"
    )

    request.add_header(
        "User-Agent",
        "ultra-flashcards/1.0"
    )

    try:

        with urllib.request.urlopen(
            request,
            timeout=30
        ) as response:

            response_body = response.read().decode("utf-8")

            return json.loads(response_body)

    except urllib.error.HTTPError as error:

        error_body = error.read().decode("utf-8")

        print(
            f"Asaas HTTP Error {error.code}: {error_body}"
        )

        raise Exception(
            f"Asaas HTTP {error.code}: {error_body}"
        )


# ==========================================================
# RESPONSE
# ==========================================================

def response(status_code, body):

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }


# ==========================================================
# LAMBDA
# ==========================================================

def lambda_handler(event, context):

    try:

        # ==================================================
        # 1. LER BODY
        # ==================================================

        body = json.loads(
            event.get("body") or "{}"
        )

        name = body.get("name")
        cpf_cnpj = body.get("cpfCnpj")
        email = body.get("email")
        value = body.get("value")
        due_date = body.get("dueDate")

        description = body.get(
            "description",
            "Pagamento PIX"
        )

        # Opcional:
        # ID do usuário no seu sistema
        user_id = body.get("userId")

        # ==================================================
        # 2. VALIDAÇÕES
        # ==================================================

        if not name:
            return response(
                400,
                {
                    "success": False,
                    "error": "name é obrigatório"
                }
            )

        if not cpf_cnpj:
            return response(
                400,
                {
                    "success": False,
                    "error": "cpfCnpj é obrigatório"
                }
            )

        if not email:
            return response(
                400,
                {
                    "success": False,
                    "error": "email é obrigatório"
                }
            )

        if value is None:
            return response(
                400,
                {
                    "success": False,
                    "error": "value é obrigatório"
                }
            )

        if not due_date:
            return response(
                400,
                {
                    "success": False,
                    "error": "dueDate é obrigatório"
                }
            )

        value = float(value)

        if value <= 0:
            return response(
                400,
                {
                    "success": False,
                    "error": "value deve ser maior que zero"
                }
            )

        # ==================================================
        # 3. CRIAR CLIENTE NO ASAAS
        # ==================================================

        customer = asaas_request(
            "POST",
            "/customers",
            {
                "name": name,
                "cpfCnpj": cpf_cnpj,
                "email": email
            }
        )

        customer_id = customer["id"]

        # ==================================================
        # 4. CRIAR COBRANÇA PIX
        # ==================================================

        payment = asaas_request(
            "POST",
            "/payments",
            {
                "customer": customer_id,
                "billingType": "PIX",
                "value": value,
                "dueDate": due_date,
                "description": description
            }
        )

        payment_id = payment["id"]

        # ==================================================
        # 5. OBTER QR CODE
        # ==================================================

        pix = asaas_request(
            "GET",
            f"/payments/{payment_id}/pixQrCode"
        )

        # ==================================================
        # 6. DATA/HORA
        # ==================================================

        created_at = datetime.now(
            timezone.utc
        ).isoformat()

        # ==================================================
        # 7. SALVAR NO DYNAMODB
        # ==================================================

        item = {

            # ------------------------------
            # Chaves principais
            # ------------------------------

            "PK": f"PAYMENT#{payment_id}",

            "SK": "PAYMENT",

            # ------------------------------
            # Identificação
            # ------------------------------

            "entityType": "PAYMENT",

            "paymentId": payment_id,

            "customerId": customer_id,

            # ------------------------------
            # Cliente
            # ------------------------------

            "name": name,

            "cpfCnpj": cpf_cnpj,

            "email": email,

            # ------------------------------
            # Pagamento
            # ------------------------------

            "value": Decimal(
                str(payment.get("value", value))
            ),

            "netValue": Decimal(
                str(
                    payment.get(
                        "netValue",
                        value
                    )
                )
            ),

            "billingType": "PIX",

            "status": payment.get(
                "status",
                "PENDING"
            ),

            "description": description,

            # ------------------------------
            # PIX
            # ------------------------------

            "pixCopyPaste": pix.get(
                "payload"
            ),

            "expirationDate": pix.get(
                "expirationDate"
            ),

            # ------------------------------
            # Dados do Asaas
            # ------------------------------

            "invoiceUrl": payment.get(
                "invoiceUrl"
            ),

            "invoiceNumber": payment.get(
                "invoiceNumber"
            ),

            # ------------------------------
            # Usuário do seu sistema
            # ------------------------------

            "userId": user_id,

            # ------------------------------
            # Datas
            # ------------------------------

            "createdAt": created_at,

            # ------------------------------
            # GSI
            # ------------------------------

            "GSI1PK": f"CUSTOMER#{customer_id}",

            "GSI1SK": f"PAYMENT#{created_at}"
        }

        # ==================================================
        # GRAVAR
        # ==================================================

        table.put_item(
            Item=item
        )

        print(
            f"Pagamento salvo no DynamoDB: {payment_id}"
        )

        # ==================================================
        # 8. RETORNAR PARA O FRONTEND
        # ==================================================

        return response(
            200,
            {
                "success": True,

                "paymentId": payment_id,

                "customerId": customer_id,

                "status": payment.get(
                    "status"
                ),

                "value": value,

                "pix": {

                    "qrCodeBase64": pix.get(
                        "encodedImage"
                    ),

                    "copyPaste": pix.get(
                        "payload"
                    ),

                    "expirationDate": pix.get(
                        "expirationDate"
                    )
                }
            }
        )

    except Exception as error:

        print(
            f"Erro ao criar pagamento PIX: {str(error)}"
        )

        return response(
            500,
            {
                "success": False,
                "error": str(error)
            }
        )