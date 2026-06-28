import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../lib/auth.js";
import { mapProfile, usageThisMonth } from "../lib/mappers.js";

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  defaultLanguage: z.enum(["auto", "english", "hindi", "hinglish"]).optional(),
  defaultTranscriptMode: z.enum(["clean", "verbatim"]).optional(),
  dataRetentionDays: z.number().int().min(1).max(365).optional(),
  notificationEmail: z.boolean().optional(),
});

export const profileRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/", async (c) => {
    const supabase = c.get("supabase");
    const userId = c.get("userId");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const { data: transactions } = await supabase
      .from("credit_transactions")
      .select("credits_used, created_at")
      .eq("user_id", userId);

    return c.json({
      profile: mapProfile(profile),
      usageThisMonth: usageThisMonth(transactions ?? []),
    });
  })
  .patch("/", async (c) => {
    const supabase = c.get("supabase");
    const userId = c.get("userId");
    const body = updateProfileSchema.parse(await c.req.json());

    const { data, error } = await supabase
      .from("profiles")
      .update({
        name: body.name,
        default_language: body.defaultLanguage,
        default_transcript_mode: body.defaultTranscriptMode,
        data_retention_days: body.dataRetentionDays,
        notification_email: body.notificationEmail,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error || !data) {
      return c.json({ error: error?.message ?? "Failed to update profile" }, 400);
    }

    return c.json({ profile: mapProfile(data) });
  });

