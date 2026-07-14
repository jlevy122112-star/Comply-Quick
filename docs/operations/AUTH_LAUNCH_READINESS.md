# Authentication Launch Readiness

## Incident record: login route failed before rendering

**Impact:** `/login` returned HTTP 500, preventing new account creation and sign-in.

**Cause:** `package.json` declared the application as CommonJS while Next.js 16, the instrumentation hook, Sentry configuration, and generated Server Action modules use ECMAScript modules. Turbopack rejected the incompatible module boundary during development and production builds.

**Repair:** The application package boundary is ESM (`"type": "module"`). The Playwright configuration targets the maintained `e2e/` suite so browser login coverage runs again.

**Release gate:** `npm run build` must succeed, followed by `npm run smoke` and the Playwright login suite against a configured environment.

## Required Supabase configuration

1. Create separate Supabase projects for development, preview, and production. Do not reuse production credentials outside production.
2. Copy `.env.example` to `.env.local` locally and add the project URL, anon key, and service-role key. Keep `.env.local` uncommitted.
3. Set the same values in the deployment platform's encrypted environment settings for each environment. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix.
4. In Supabase Auth URL Configuration, set the production Site URL to the canonical HTTPS application origin and add exact redirect URLs for:
   - `https://<app-host>/auth/callback`
   - `https://<app-host>/auth/reset`
   - each approved preview and localhost origin used for testing
5. Configure production SMTP, a verified sender domain, and email templates whose confirmation, magic-link, and recovery URLs use the allowed callback route.
6. Decide and document the email-confirmation policy. With confirmation enabled, registration must show the confirmation notice; with it disabled, registration must redirect to the dashboard with an active session.
7. Restrict Auth rate limits, enable leaked-password protection, and configure the approved OAuth redirect URLs before enabling external providers.
8. Apply tracked migrations to each environment and verify RLS policies before exposing registration.

## Verification checklist

1. Run `npm run build` with the deployment environment variables.
2. Run `npm run smoke`.
3. In a non-production environment, register a new disposable user, receive and open the confirmation email, sign in, refresh the dashboard, sign out, and sign in again.
4. Check the browser network log confirms no service-role credential is sent to the client.

## Production launch gate

Complete this checklist in a staging environment first, then repeat the
production-only checks immediately before release.

### Configuration and access

1. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin. Set all other
   secrets in the hosting platform, never in source control or `NEXT_PUBLIC_`
   variables.
2. Configure live Stripe credentials: `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, and every `STRIPE_PRICE_*` value listed in
   `.env.example`. Confirm that the price currency and recurring interval match
   each published plan.
3. Create the Stripe webhook endpoint at `/api/webhooks/stripe`, subscribe it
   to the events handled by that route, and verify a signed test event returns
   200. Retry behavior must be left enabled.
4. Configure a production Sentry DSN and release/source-map upload credentials.
   Send a controlled non-sensitive error and confirm it appears with release
   metadata.
5. Restrict production admin email allowlists and rotate any credential that was
   copied into an unencrypted channel during setup.

### Database and security

1. Apply every tracked Supabase migration to a staging project, verify RLS with
   a standard user account, then apply the identical migration set to
   production.
2. Confirm the production Supabase project has point-in-time recovery or a
   tested backup/export procedure, and record the recovery owner.
3. Confirm the production hostname terminates TLS, redirects HTTP to HTTPS, and
   serves the security headers configured in `next.config.ts`.
4. Enable Supabase leaked-password protection and rate limits, and verify only
   approved callback, reset, and preview URLs are allowlisted.

### Release verification and rollback

1. Require `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`,
   `npm run smoke`, and the browser login suite to pass on the release commit.
2. After deployment, create a disposable account, complete email confirmation,
   magic-link login, package generation, paid checkout in Stripe test mode, and
   webhook-driven entitlement activation.
3. Monitor Sentry, Stripe webhook delivery, hosting logs, and Supabase errors
   for the first hour. Assign an on-call owner before opening traffic.
4. If a critical regression occurs, roll back to the last verified deployment,
   disable affected optimization flags, and preserve logs/webhook event IDs for
   reconciliation. Do not roll back database migrations without a reviewed
   recovery procedure.
