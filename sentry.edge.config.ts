// Sentry initialization for the Edge runtime (middleware, edge routes).
// Env-gated identically to the server config — inert without `SENTRY_DSN`.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
