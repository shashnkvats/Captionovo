import { loadEnv } from "../lib/env.js";
import { createAdminClient } from "../lib/supabase.js";
import { startJobPoller } from "../jobs/queue.js";
import { createWorker } from "../jobs/worker.js";

const env = loadEnv();
const admin = createAdminClient(env);
const { queue, runner } = createWorker(env, admin);

console.log("Captionovo worker started");
startJobPoller(queue, runner);

setInterval(() => {}, 60_000).unref?.();
