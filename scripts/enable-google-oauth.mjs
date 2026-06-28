#!/usr/bin/env node
/**
 * Enables Google OAuth via Supabase Auth custom OIDC provider.
 * Reads credentials from repo root .env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env or backend/.env.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(ROOT, ".env"));
loadEnvFile(join(ROOT, "backend", ".env"));

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zzxsxccapuwefkvqixad.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
requireEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const providerPayload = {
  provider_type: "oidc",
  identifier: "custom:google",
  name: "Google",
  client_id: GOOGLE_CLIENT_ID,
  client_secret: GOOGLE_CLIENT_SECRET,
  issuer: "https://accounts.google.com",
  scopes: ["openid", "email", "profile"],
  authorization_params: {
    access_type: "offline",
    prompt: "consent",
  },
};

console.log("Enabling Google OAuth provider (custom:google)...");

const { data: existing, error: listError } =
  await supabase.auth.admin.customProviders.listProviders();

if (listError) {
  console.error("Failed to list providers:", listError.message);
  process.exit(1);
}

const found = existing?.find((p) => p.identifier === "custom:google");

let result;
if (found) {
  result = await supabase.auth.admin.customProviders.updateProvider(
    "custom:google",
    { ...providerPayload, enabled: true },
  );
} else {
  result = await supabase.auth.admin.customProviders.createProvider(providerPayload);
}

if (result.error) {
  console.error("Failed to configure Google OAuth:", result.error.message);
  process.exit(1);
}

console.log("Google OAuth enabled.");
console.log("");
console.log("Ensure Google Cloud Console has:");
console.log("  Origin: http://localhost:3000");
console.log(
  "  Redirect: https://zzxsxccapuwefkvqixad.supabase.co/auth/v1/callback",
);
