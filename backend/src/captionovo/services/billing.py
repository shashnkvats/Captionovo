from captionovo.domain.billing import CreditPack
from captionovo.services.credits import CreditsService

DEFAULT_PACKS = [
    CreditPack(id="starter", name="Starter", credits=120, price_cents=499),
    CreditPack(id="creator", name="Creator", credits=600, price_cents=1999),
    CreditPack(id="studio", name="Studio", credits=1500, price_cents=4499),
]


class BillingNotConfiguredError(Exception):
    pass


class BillingService:
    def __init__(self, admin, credits: CreditsService) -> None:
        self._admin = admin
        self._credits = credits

    def list_packs(self) -> list[CreditPack]:
        try:
            result = (
                self._admin.table("credit_packs")
                .select("*")
                .eq("active", True)
                .order("sort_order")
                .execute()
            )
            if not result.data:
                return DEFAULT_PACKS
            return [
                CreditPack(
                    id=row["id"],
                    name=row["name"],
                    credits=row["credits"],
                    price_cents=row["price_cents"],
                    stripe_price_id=row.get("stripe_price_id"),
                )
                for row in result.data
            ]
        except Exception:
            return DEFAULT_PACKS

    def create_checkout_session(self, user_id: str, request) -> dict:
        packs = self.list_packs()
        pack = next((p for p in packs if p.id == request.pack_id), None)
        if not pack:
            raise ValueError("Unknown credit pack")

        import os

        if not os.getenv("STRIPE_SECRET_KEY"):
            raise BillingNotConfiguredError(
                "Stripe is not configured. Set STRIPE_SECRET_KEY to enable purchases."
            )

        raise BillingNotConfiguredError("Stripe checkout not implemented yet")

    def handle_stripe_webhook(self, payload: bytes, signature: str | None) -> None:
        import os

        if not os.getenv("STRIPE_WEBHOOK_SECRET"):
            raise BillingNotConfiguredError("Stripe webhook secret not configured")

        raise BillingNotConfiguredError("Stripe webhook handler not implemented yet")


def create_billing_service(admin):
    credits = CreditsService(admin)
    return {"credits": credits, "billing": BillingService(admin, credits)}
