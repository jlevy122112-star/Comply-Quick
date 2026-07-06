// Sentry initialization for the Node.js server runtime.
//
// Loaded from `src/instrumentation.ts` when the app boots on the Node runtime.
// Env-gated: with no `SENTRY_DSN` set the SDK stays disabled and adds no
// overhead, so local dev and preview builds are inert until the DSN is
// configured in the deployment.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

// Base per-environment trace sample rate: 100% in dev, 10% in production.
const BASE_TRACES_RATE = process.env.NODE_ENV === "development" ? 1.0 : 0.1;

// Routes that invoke the OpenAI client (scanner, "Fix It" intelligence, and
// Autopilot). AI agent monitoring samples a whole trace tree — if the root
// transaction is dropped, its child gen_ai spans are lost too — so we keep
// these transactions at 100% for full AI visibility while other traffic stays
// at the base rate.
const AI_ROUTE = /\/api\/(scanner|intelligence|autopilot)\b/;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampler: (ctx) => {
    if (typeof ctx.name === "string" && AI_ROUTE.test(ctx.name)) return 1.0;
    if (typeof ctx.parentSampled === "boolean") return ctx.parentSampled ? 1.0 : 0.0;
    return BASE_TRACES_RATE;
  },
  integrations: [
    // Auto-instrument OpenAI calls. Metadata only (model, latency, tokens);
    // prompts/outputs are NOT recorded, since they can contain client PII.
    Sentry.openAIIntegration({ recordInputs: false, recordOutputs: false }),
  ],
  // Attach local variable values to server stack frames for richer debugging.
  includeLocalVariables: true,
  // Route the app's structured logs into Sentry Logs.
  enableLogs: true,
  // Don't capture PII by default; compliance data must not leak into traces.
  sendDefaultPii: false,
});
