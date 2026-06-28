import type { AppSupabaseClient } from "../lib/supabase.js";
import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  CreditPack,
} from "../domain/billing.js";
import { CreditsService } from "./credits.js";

export class BillingService {
  constructor(
    private readonly admin: AppSupabaseClient,
    private readonly credits: CreditsService,
  ) {}

  async listPacks(): Promise<CreditPack[]> {
    const { data, error } = await this.admin
      .from("credit_packs")
      .select("*")
      .eq("active", true)
      .order("sort_order");

    if (error) {
      // Table may not exist until migration is applied — return defaults.
      return DEFAULT_PACKS;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      credits: row.credits,
      priceCents: row.price_cents,
      stripePriceId: row.stripe_price_id ?? undefined,
    }));
  }

  async createCheckoutSession(
    userId: string,
    request: CheckoutSessionRequest,
  ): Promise<CheckoutSessionResponse> {
    const packs = await this.listPacks();
    const pack = packs.find((candidate) => candidate.id === request.packId);
    if (!pack) throw new Error("Unknown credit pack");

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new BillingNotConfiguredError(
        "Stripe is not configured. Set STRIPE_SECRET_KEY to enable purchases.",
      );
    }

    // Stripe Checkout session creation plugs in here.
    void userId;
    void request;
    throw new BillingNotConfiguredError("Stripe checkout not implemented yet");
  }

  async handleStripeWebhook(_payload: Buffer, _signature: string | undefined) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new BillingNotConfiguredError("Stripe webhook secret not configured");
    }

    // Verify signature, parse event, call credits.grantCredits on checkout.session.completed
    throw new BillingNotConfiguredError("Stripe webhook handler not implemented yet");
  }
}

export class BillingNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const DEFAULT_PACKS: CreditPack[] = [
  { id: "starter", name: "Starter", credits: 120, priceCents: 499 },
  { id: "creator", name: "Creator", credits: 600, priceCents: 1999 },
  { id: "studio", name: "Studio", credits: 1500, priceCents: 4499 },
];

export function createBillingService(admin: AppSupabaseClient) {
  const credits = new CreditsService(admin);
  return { credits, billing: new BillingService(admin, credits) };
}
