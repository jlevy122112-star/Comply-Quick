import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {/* config options here */};

// Wrap with Sentry so build-time integration (release tagging, tunneling,
// source maps when SENTRY_AUTH_TOKEN is set) is wired up. Options that require
// a build-time bundler transform are no-ops under Turbopack (Next 16 default),
// which is fine — runtime error capture is driven by instrumentation.ts.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Upload a wider set of client source files for better stack-trace resolution.
  widenClientFileUpload: true,
  // Proxy Sentry ingestion through a same-origin route so ad-blockers don't drop
  // events. The proxy (src/proxy.ts) excludes this path from its rewrite/session
  // logic.
  tunnelRoute: "/monitoring",
  // Only upload source maps when an auth token is present (deploys); keeps
  // local/CI builds without the token fast and side-effect free.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
