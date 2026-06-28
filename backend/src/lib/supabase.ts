import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.js";
import type { Env } from "./env.js";

export type AppSupabaseClient = SupabaseClient<Database>;

export function createAdminClient(env: Env): AppSupabaseClient {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(env: Env, accessToken: string): AppSupabaseClient {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
