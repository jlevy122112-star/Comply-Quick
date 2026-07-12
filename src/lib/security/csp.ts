// Content-Security-Policy with a per-request nonce.
//
// The real XSS control is `script-src 'nonce-<nonce>' 'strict-dynamic'`: only
// scripts carrying this request's nonce (Next.js injects it into its own
// bootstrap/hydration and every `next/script`) — and scripts those trusted
// scripts load in turn (strict-dynamic) — may execute. The trailing `https:`
// and `'unsafe-inline'` are deliberately kept as a fallback for legacy browsers
// that don't understand strict-dynamic/nonces; conforming browsers ignore them.
//
// Non-script directives stay intentionally permissive so first-party plumbing
// keeps working without an allowlist that silently breaks on the next vendor
// change: Supabase (https + realtime `wss:`), Vercel Analytics/Speed Insights,
// Google Analytics/Clarity `collect` beacons, and the same-origin Sentry tunnel
// (`/monitoring`). Stripe uses hosted Checkout (a full-page redirect to
// checkout.stripe.com), so no Stripe script runs on our own pages.
//
// Rollout: defaults to Report-Only so a missed inline script surfaces as a
// report instead of a broken page. Set CSP_MODE=enforce to switch the browser
// to blocking once reports are clean.

import { randomBytes } from "crypto";

export type CspMode = "enforce" | "report-only";

/** Deployment CSP mode. Enforcing only when explicitly opted in. */
export function cspMode(): CspMode {
  return process.env.CSP_MODE === "enforce" ? "enforce" : "report-only";
}

/** A fresh base64 nonce for one request. */
export function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

/** The browser-facing header name for the active mode. */
export function cspHeaderName(mode: CspMode = cspMode()): string {
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

/** Builds the full policy string for a given nonce. */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
    "frame-ancestors 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "base-uri 'self'",
    "object-src 'none'",
    "report-uri /api/csp-report",
  ].join("; ");
}
