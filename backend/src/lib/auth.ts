import { createMiddleware } from "hono/factory";
import type { AppSupabaseClient } from "./supabase.js";
import { createUserClient } from "./supabase.js";
import type { Env } from "./env.js";

export type AuthVariables = {
  accessToken: string;
  userId: string;
  supabase: AppSupabaseClient;
};

export function authMiddleware(env: Env) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const accessToken = header.slice("Bearer ".length).trim();
    const supabase = createUserClient(env, accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return c.json({ error: "Invalid or expired session" }, 401);
    }

    c.set("accessToken", accessToken);
    c.set("userId", data.user.id);
    c.set("supabase", supabase);
    await next();
  });
}
