import json
import os
import boto3
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb")

table = dynamodb.Table(
    os.environ["TABLE_NAME"]
)

def lambda_handler(event, context):

    print("Evento recebido:")
    print(json.dumps(event))

    body = json.loads(
        event.get("body") or "{}"
    )

    event_type = body.get("event")

    payment = body.get(
        "payment",
        {}
    )

    payment_id = payment.get("id")

    print(f"Evento: {event_type}")
    print(f"Payment ID: {payment_id}")

    if not payment_id:
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "payment.id não informado"
            })
        }

    # ======================================================
    # PAGAMENTO RECEBIDO
    # ======================================================

    if event_type == "PAYMENT_RECEIVED":

        table.update_item(
            Key={
                "PK": f"PAYMENT#{payment_id}",
                "SK": "PAYMENT"
            },

            UpdateExpression="""
                SET #status = :status,
                    providerStatus = :providerStatus,
                    paidAt = :paidAt
            """,

            ExpressionAttributeNames={
                "#status": "status"
            },

            ExpressionAttributeValues={
                ":status": "PAID",
                ":providerStatus": "RECEIVED",
                ":paidAt": datetime.now(
                    timezone.utc
                ).isoformat()
            }
        )

        print(
            f"Pagamento {payment_id} atualizado para PAID"
        )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "success": True
        })
    }