import type { AppSupabaseClient } from "../lib/supabase.js";
import type { CreditReservation, CreditTransactionType } from "../domain/billing.js";

export class CreditsService {
  constructor(private readonly admin: AppSupabaseClient) {}

  async getAvailableCredits(userId: string): Promise<number> {
    const { data, error } = await this.admin
      .from("profiles")
      .select("credits_remaining, credits_reserved")
      .eq("id", userId)
      .single();

    if (error || !data) throw new Error("Profile not found");
    return data.credits_remaining - data.credits_reserved;
  }

  async reserve(input: CreditReservation): Promise<void> {
    const existing = await this.admin
      .from("credit_transactions")
      .select("id")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existing.data) return;

    const { data: profile, error: profileError } = await this.admin
      .from("profiles")
      .select("credits_remaining, credits_reserved")
      .eq("id", input.userId)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const available = profile.credits_remaining - profile.credits_reserved;
    if (available < input.amount) {
      throw new InsufficientCreditsError(available, input.amount);
    }

    const { error: profileUpdateError } = await this.admin
      .from("profiles")
      .update({ credits_reserved: profile.credits_reserved + input.amount })
      .eq("id", input.userId);

    if (profileUpdateError) throw new Error(profileUpdateError.message);

    const { error: projectUpdateError } = await this.admin
      .from("projects")
      .update({
        credits_reserved: input.amount,
        duration_minutes: input.durationMinutes,
        reservation_idempotency_key: input.idempotencyKey,
      })
      .eq("id", input.projectId);

    if (projectUpdateError) throw new Error(projectUpdateError.message);

    const { error: txError } = await this.admin.from("credit_transactions").insert({
      user_id: input.userId,
      project_id: input.projectId,
      project_title: input.projectTitle,
      duration_minutes: input.durationMinutes,
      credits_used: input.amount,
      output_types: input.outputTypes,
      transaction_type: "reserve" satisfies CreditTransactionType,
      idempotency_key: input.idempotencyKey,
    });

    if (txError) throw new Error(txError.message);
  }

  async release(projectId: string, userId: string): Promise<void> {
    const idempotencyKey = `release:${projectId}`;
    const existing = await this.admin
      .from("credit_transactions")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing.data) return;

    const { data: project, error: projectError } = await this.admin
      .from("projects")
      .select("credits_reserved, title, duration_minutes, outputs")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project || project.credits_reserved <= 0) return;

    const { data: profile, error: profileError } = await this.admin
      .from("profiles")
      .select("credits_reserved")
      .eq("id", userId)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const { error: profileUpdateError } = await this.admin
      .from("profiles")
      .update({
        credits_reserved: Math.max(0, profile.credits_reserved - project.credits_reserved),
      })
      .eq("id", userId);

    if (profileUpdateError) throw new Error(profileUpdateError.message);

    await this.admin
      .from("projects")
      .update({ credits_reserved: 0, reservation_idempotency_key: null })
      .eq("id", projectId);

    await this.admin.from("credit_transactions").insert({
      user_id: userId,
      project_id: projectId,
      project_title: project.title,
      duration_minutes: project.duration_minutes,
      credits_used: project.credits_reserved,
      output_types: project.outputs,
      transaction_type: "release" satisfies CreditTransactionType,
      idempotency_key: idempotencyKey,
    });
  }

  async commitFromReservation(projectId: string, userId: string): Promise<void> {
    const idempotencyKey = `usage:${projectId}`;
    const existing = await this.admin
      .from("credit_transactions")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing.data) return;

    const { data: project, error: projectError } = await this.admin
      .from("projects")
      .select("title, duration_minutes, outputs, credits_reserved, credits_used")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) throw new Error("Project not found");

    const amount = project.credits_reserved || project.duration_minutes || 1;

    const { data: profile, error: profileError } = await this.admin
      .from("profiles")
      .select("credits_remaining, credits_reserved")
      .eq("id", userId)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const { error: profileUpdateError } = await this.admin
      .from("profiles")
      .update({
        credits_remaining: Math.max(0, profile.credits_remaining - amount),
        credits_reserved: Math.max(0, profile.credits_reserved - (project.credits_reserved || amount)),
      })
      .eq("id", userId);

    if (profileUpdateError) throw new Error(profileUpdateError.message);

    await this.admin
      .from("projects")
      .update({
        credits_used: amount,
        credits_reserved: 0,
        reservation_idempotency_key: null,
      })
      .eq("id", projectId);

    const { error: txError } = await this.admin.from("credit_transactions").insert({
      user_id: userId,
      project_id: projectId,
      project_title: project.title,
      duration_minutes: project.duration_minutes,
      credits_used: amount,
      output_types: project.outputs,
      transaction_type: "usage" satisfies CreditTransactionType,
      idempotency_key: idempotencyKey,
    });

    if (txError) throw new Error(txError.message);
  }

  /** @deprecated Use commitFromReservation after confirm-upload flow */
  async commitUsage(reservation: CreditReservation) {
    await this.commitFromReservation(reservation.projectId, reservation.userId);
  }

  async grantCredits(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    metadata: Record<string, unknown> = {},
  ) {
    const { data: profile, error: profileError } = await this.admin
      .from("profiles")
      .select("credits_remaining")
      .eq("id", userId)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const { error: updateError } = await this.admin
      .from("profiles")
      .update({ credits_remaining: profile.credits_remaining + amount })
      .eq("id", userId);

    if (updateError) throw new Error(updateError.message);

    const { error: txError } = await this.admin.from("credit_transactions").insert({
      user_id: userId,
      project_id: null,
      project_title: type === "purchase" ? "Credit purchase" : "Credit adjustment",
      duration_minutes: 0,
      credits_used: -amount,
      output_types: [],
      transaction_type: type,
      metadata,
    });

    if (txError) throw new Error(txError.message);
  }
}

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly creditsRemaining: number,
    public readonly creditsNeeded: number,
  ) {
    super("Insufficient credits");
  }
}
