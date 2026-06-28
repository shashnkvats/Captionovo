from dataclasses import dataclass


@dataclass
class CreditReservation:
    user_id: str
    project_id: str
    amount: int
    project_title: str
    output_types: list[str]
    duration_minutes: int
    idempotency_key: str


@dataclass
class CreditPack:
    id: str
    name: str
    credits: int
    price_cents: int
    stripe_price_id: str | None = None


@dataclass
class CheckoutSessionRequest:
    pack_id: str
    success_url: str
    cancel_url: str


@dataclass
class CheckoutSessionResponse:
    checkout_url: str
    session_id: str
