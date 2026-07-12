import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Security response headers applied to every route. HSTS enforces HTTPS/TLS at
// the browser (only sent over HTTPS in production, so local HTTP is unaffected).
// A conservative set is used to avoid breaking third-party embeds (Stripe,
// Sentry tunnel); a full Content-Security-Policy is intentionally omitted here
// because the app relies on inline/third-party scripts that would require a
// nonce pipeline to lock down safely.
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

// Wrap with Sentry so build-time integration (release tagging, tunneling,
// source maps when SENTRY_AUTH_TOKEN is set) is wired up. Options that require
// a build-time bundler transform are no-ops under Turbopack (Next 16 default),
// which is fine — runtime error capture is driven by instrumentation.ts.
export default withSentryConfig(nextConfig, {
  // Org/project slugs are not secret; default to the known Sentry project so
  // source-map upload resolves correctly once SENTRY_AUTH_TOKEN is present.
  org: process.env.SENTRY_ORG || "comply-quick",
  project: process.env.SENTRY_PROJECT || "javascript-nextjs",
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
