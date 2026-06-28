import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../lib/auth.js";
import { mapCreditTransaction } from "../lib/mappers.js";
import type { Env } from "../lib/env.js";
import { createAdminClient } from "../lib/supabase.js";
import { createBillingService, BillingNotConfiguredError } from "../services/billing.js";

const checkoutSchema = z.object({
  packId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export function billingRoutes(env: Env) {
  const admin = createAdminClient(env);
  const { billing } = createBillingService(admin);

  return new Hono<{ Variables: AuthVariables }>()
    .get("/transactions", async (c) => {
      const supabase = c.get("supabase");
      const userId = c.get("userId");

      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) return c.json({ error: error.message }, 400);

      return c.json({
        transactions: (data ?? []).map(mapCreditTransaction),
      });
    })
    .get("/packs", async (c) => {
      const packs = await billing.listPacks();
      return c.json({ packs });
    })
    .post("/checkout", async (c) => {
      const userId = c.get("userId");
      const body = checkoutSchema.parse(await c.req.json());

      try {
        const session = await billing.createCheckoutSession(userId, body);
        return c.json(session);
      } catch (error) {
        if (error instanceof BillingNotConfiguredError) {
          return c.json({ error: error.message }, 501);
        }
        throw error;
      }
    });
}

export function billingWebhookRoutes(env: Env) {
  const admin = createAdminClient(env);
  const { billing } = createBillingService(admin);

  return new Hono().post("/webhook", async (c) => {
    const signature = c.req.header("stripe-signature");
    const payload = Buffer.from(await c.req.arrayBuffer());

    try {
      await billing.handleStripeWebhook(payload, signature);
      return c.json({ received: true });
    } catch (error) {
      if (error instanceof BillingNotConfiguredError) {
        return c.json({ error: error.message }, 501);
      }
      throw error;
    }
  });
}
