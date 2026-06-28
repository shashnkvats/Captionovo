#!/usr/bin/env node
/**
 * Configures Google OAuth + redirect URLs on the Supabase project via Management API.
 *
 * Reads env from: process.env, ./scripts/.env, ./.env (repo root)
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
loadEnvFile(join(ROOT, "scripts", ".env"));

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "zzxsxccapuwefkvqixad";
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const GOOGLE_CALLBACK = `https://${PROJECT_REF}.supabase.co/auth/v1/callback`;
const APP_CALLBACK = `${SITE_URL}/auth/callback`;

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}`);
    console.error("Add it to .env or export it before running this script.");
    process.exit(1);
  }
}

requireEnv("SUPABASE_ACCESS_TOKEN", TOKEN);
requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
requireEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);

const body = {
  site_url: SITE_URL,
  uri_allow_list: `${APP_CALLBACK},${SITE_URL}/**`,
  external_google_enabled: true,
  external_google_client_id: GOOGLE_CLIENT_ID,
  external_google_secret: GOOGLE_CLIENT_SECRET,
};

console.log("Configuring Supabase Auth...");
console.log(`  Project:   ${PROJECT_REF}`);
console.log(`  Site URL:  ${SITE_URL}`);
console.log(`  Redirects: ${body.uri_allow_list}`);
console.log("");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

const data = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error("Failed to configure auth:", JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("Google OAuth enabled successfully.");
