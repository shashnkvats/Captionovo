import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./lib/auth.js";
import { loadEnv } from "./lib/env.js";
import { profileRoutes } from "./routes/profile.js";
import { billingRoutes, billingWebhookRoutes } from "./routes/billing.js";
import { projectRoutes } from "./routes/projects.js";
import { transcriptRoutes } from "./routes/transcript.js";
import { exportRoutes } from "./routes/exports.js";

const env = loadEnv();

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) =>
  c.json({ status: "ok", service: "captionovo-api", timestamp: new Date().toISOString() }),
);

app.route("/billing", billingWebhookRoutes(env));

const auth = authMiddleware(env);

const api = new Hono();
api.use("*", auth);
api.route("/profile", profileRoutes);
api.route("/billing", billingRoutes(env));
api.route("/projects", projectRoutes(env));
api.route("/projects", transcriptRoutes);
api.route("/projects", exportRoutes);

app.route("/", api);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Captionovo API running on http://localhost:${info.port}`);
});
