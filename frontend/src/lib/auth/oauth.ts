import type { SupabaseClient } from "@supabase/supabase-js";

export function getOAuthCallbackUrl(next = "/dashboard") {
  const origin = window.location.origin;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithGoogle(
  supabase: SupabaseClient,
  next = "/dashboard",
) {
  return supabase.auth.signInWithOAuth({
    provider: "custom:google",
    options: {
      redirectTo: getOAuthCallbackUrl(next),
    },
  });
}

export function getOAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "auth_callback_failed":
      return "Google sign-in failed. Check that Google OAuth is enabled in Supabase and redirect URLs are configured.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
