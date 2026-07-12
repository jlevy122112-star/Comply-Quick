# Change Management Runbook

Every change to production — code, schema, configuration — follows this process.
The goal is that no change reaches production without review, automated
verification, and a defined rollback.

## 1. Principles

- **No direct pushes to `main`.** All changes land through a pull request.
- **Review required.** A PR needs human review plus automated review (Devin
  Review / CodeQL) before merge.
- **CI is a gate, not a suggestion.** The `quality`, `CodeQL`, and `Analyze`
  checks must pass.
- **Reversible by default.** Every change must have a rollback path (see §5).

## 2. Standard change flow

1. Branch from `main` (`devin/<timestamp>-<slug>` or the team convention).
2. Implement the change in a focused, minimal diff.
3. Run locally: `npx tsc --noEmit`, `npx eslint`, and `npx vitest run`.
4. Open a PR using the repository PR template; describe *what* and *why*.
5. CI runs: **quality** (lint/typecheck/tests), **CodeQL** (security),
   **Analyze**, plus a **Vercel preview** deployment for manual verification.
6. Address review feedback (human + automated) in additional commits — never
   force-push shared branches, never amend merged history.
7. Merge once green and approved. Vercel promotes `main` to production.

## 3. Database / schema changes

- Schema changes are **migrations** committed under `supabase/migrations/`,
  numbered sequentially (e.g. `0037_scim_provisioning.sql`).
- Migrations **auto-apply via the Supabase GitHub integration on merge** — they
  are not run by hand against production.
- Migrations must be **forward-safe**: additive where possible, RLS policies
  included for any new table, and written so a rollback of the app code does not
  corrupt data.
- New tables that hold tenant data **must** enable Row Level Security and ship
  the appropriate org/workspace-scoped policies in the same migration.

## 4. Configuration & secrets

- Secrets live in the platform environment (Vercel / Supabase / GitHub), never
  in the repo. Rotating a secret is itself a change — record it.
- Never weaken security controls (RLS, security headers, rate limiting, CI
  gates) to make a change land. Escalate instead.

## 5. Rollback

| Change type | Rollback |
| --- | --- |
| App code | Vercel → promote the previous production deployment (near-instant). |
| Migration | Ship a new **forward** migration that reverses the change; do not hand-edit applied migrations. Because migrations are additive/forward-safe, rolling back app code alone is usually safe. |
| Config/secret | Restore the previous value in the platform and redeploy. |

## 6. Emergency changes

During a Sev-1/Sev-2 (see `INCIDENT_RESPONSE.md`) speed matters, but the change
is still made on a branch, still passes CI, and still gets a (possibly
expedited) review. Record the emergency justification in the PR. A retroactive
review happens in the post-incident review if a step was compressed.

## 7. Release record

The PR history on `main` **is** the change log: each merged PR is a dated,
authored, reviewed record of what changed and why. No separate change ledger is
maintained.

_Last reviewed: 2026-07-12._
