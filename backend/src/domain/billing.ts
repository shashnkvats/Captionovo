export type CreditTransactionType =
  | "usage"
  | "purchase"
  | "bonus"
  | "refund"
  | "adjustment"
  | "reserve"
  | "release";

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  stripePriceId?: string;
}

export interface CreditReservation {
  userId: string;
  projectId: string;
  amount: number;
  projectTitle: string;
  outputTypes: string[];
  durationMinutes: number;
  idempotencyKey: string;
}

export interface CheckoutSessionRequest {
  packId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}
