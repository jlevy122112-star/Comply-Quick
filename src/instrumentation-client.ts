// Sentry initialization for the browser. Env-gated on the public DSN so it is
// inert in local dev / previews that don't set it. `onRouterTransitionStart`
// lets Sentry track client-side navigations.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  // 100% of traces in dev, 10% in production.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Session Replay: sample 10% of sessions, 100% of sessions that hit an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  sendDefaultPii: false,
  integrations: [Sentry.replayIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
