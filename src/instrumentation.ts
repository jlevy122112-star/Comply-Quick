// Next.js instrumentation hook — runs once per runtime at boot.
// Loads the matching Sentry init for the active runtime. `onRequestError`
// forwards uncaught errors from nested React Server Components to Sentry.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
