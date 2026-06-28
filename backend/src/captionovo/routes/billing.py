from fastapi import APIRouter, Depends, HTTPException, Request

from captionovo.auth import AuthContext, get_auth_context
from captionovo.config import Settings, get_settings
from captionovo.mappers import map_credit_transaction
from captionovo.schemas import CheckoutBody
from captionovo.services.billing import BillingNotConfiguredError, create_billing_service
from captionovo.supabase_client import create_admin_client

router = APIRouter(prefix="/billing", tags=["billing"])
webhook_router = APIRouter(prefix="/billing", tags=["billing"])


def _pack_to_response(pack) -> dict:
    result = {
        "id": pack.id,
        "name": pack.name,
        "credits": pack.credits,
        "priceCents": pack.price_cents,
    }
    if pack.stripe_price_id:
        result["stripePriceId"] = pack.stripe_price_id
    return result


@router.get("/transactions")
async def list_transactions(auth: AuthContext = Depends(get_auth_context)):
    result = (
        auth.supabase.table("credit_transactions")
        .select("*")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=True)
        .execute()
    )
    if result.data is None and hasattr(result, "error") and result.error:
        raise HTTPException(status_code=400, detail={"error": str(result.error)})

    return {"transactions": [map_credit_transaction(row) for row in (result.data or [])]}


@router.get("/packs")
async def list_packs(settings: Settings = Depends(get_settings)):
    admin = create_admin_client(settings)
    billing = create_billing_service(admin)["billing"]
    packs = billing.list_packs()
    return {"packs": [_pack_to_response(p) for p in packs]}


@router.post("/checkout")
async def checkout(body: CheckoutBody, auth: AuthContext = Depends(get_auth_context)):
    admin = create_admin_client(get_settings())
    billing = create_billing_service(admin)["billing"]

    from captionovo.domain.billing import CheckoutSessionRequest

    request = CheckoutSessionRequest(
        pack_id=body.pack_id,
        success_url=str(body.success_url),
        cancel_url=str(body.cancel_url),
    )

    try:
        session = billing.create_checkout_session(auth.user_id, request)
        return session
    except BillingNotConfiguredError as exc:
        raise HTTPException(status_code=501, detail={"error": str(exc)}) from exc


@webhook_router.post("/webhook")
async def stripe_webhook(request: Request, settings: Settings = Depends(get_settings)):
    signature = request.headers.get("stripe-signature")
    payload = await request.body()

    admin = create_admin_client(settings)
    billing = create_billing_service(admin)["billing"]

    try:
        billing.handle_stripe_webhook(payload, signature)
        return {"received": True}
    except BillingNotConfiguredError as exc:
        raise HTTPException(status_code=501, detail={"error": str(exc)}) from exc
