// Sentry initialization for the browser. Env-gated on the public DSN so it is
// inert in local dev / previews that don't set it. `onRouterTransitionStart`
// lets Sentry track client-side navigations.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
