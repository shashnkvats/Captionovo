import type { Env } from "../lib/env.js";
import { createStubProviders } from "./stub/index.js";
import type { ProviderRegistry } from "./types.js";

export function createProviders(_env: Env): ProviderRegistry {
  // Future: switch on env.TRANSCRIPTION_PROVIDER for Deepgram, AssemblyAI, etc.
  return createStubProviders();
}
