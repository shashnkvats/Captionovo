import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(backendRoot, "..");

function loadEnvFiles() {
  const paths = [
    resolve(backendRoot, ".env"),
    resolve(repoRoot, ".env"),
    resolve(repoRoot, "frontend/.env.local"),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      config({ path, override: false });
    }
  }

  // Map frontend public vars when backend-specific ones are not set
  if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
}

loadEnvFiles();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  TRANSCRIPTION_PROVIDER: z.enum(["stub", "deepgram", "assemblyai"]).default("stub"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    console.error("");
    console.error("Create backend/.env with:");
    console.error("  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
    console.error("");
    console.error("Get keys from:");
    console.error("  https://supabase.com/dashboard/project/zzxsxccapuwefkvqixad/settings/api");
    throw new Error("Missing or invalid environment variables in backend/.env");
  }
  return parsed.data;
}
