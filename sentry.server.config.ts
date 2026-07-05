// Sentry initialization for the Node.js server runtime.
//
// Loaded from `src/instrumentation.ts` when the app boots on the Node runtime.
// Env-gated: with no `SENTRY_DSN` set the SDK stays disabled and adds no
// overhead, so local dev and preview builds are inert until the DSN is
// configured in the deployment.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Don't capture PII by default; compliance data must not leak into traces.
  sendDefaultPii: false,
});
