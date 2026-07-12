// Multi-factor authentication (TOTP) helpers.
//
// The heavy lifting is done by Supabase Auth's `auth.mfa.*` API. These helpers
// are the small, pure, unit-testable pieces around it: deciding whether a
// just-authenticated session still needs a second-factor challenge, and
// normalizing/validating the 6-digit code a user types from their authenticator
// app before we spend a network round-trip on it.

/**
 * Supabase Authenticator Assurance Levels. `aal1` = single factor (password,
 * magic link, OAuth); `aal2` = a second factor (TOTP) has also been verified.
 */
export type AuthAssuranceLevel = "aal1" | "aal2";

/**
 * Result of comparing the session's current AAL to the level it *could* reach.
 *
 * - `challenge`: the account has a verified second factor but the current
 *   session hasn't cleared it yet — prompt for a TOTP code.
 * - `satisfied`: the session is already at the highest level available.
 * - `not_enrolled`: no second factor is configured, so nothing to prompt for.
 */
export type MfaGate = "challenge" | "satisfied" | "not_enrolled";

/**
 * Decides what to do after a primary sign-in, given the assurance levels
 * reported by `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
 *
 * `next` is the highest level the session could reach: when it is `aal2` but the
 * `current` level is still `aal1`, a verified factor exists and must be
 * challenged. When `next` is `aal1`, the account has no verified second factor.
 */
export function mfaGate(current: AuthAssuranceLevel | null, next: AuthAssuranceLevel | null): MfaGate {
  if (next !== "aal2") return "not_enrolled";
  return current === "aal2" ? "satisfied" : "challenge";
}

/** A TOTP code is exactly six ASCII digits. */
const TOTP_CODE = /^\d{6}$/;

/**
 * Strips spaces/dashes an authenticator app may render for readability
 * (e.g. "123 456") and returns the canonical 6-digit code, or `null` if the
 * input isn't a valid TOTP code.
 */
export function normalizeTotpCode(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]/g, "");
  return TOTP_CODE.test(cleaned) ? cleaned : null;
}

export function isValidTotpCode(raw: string): boolean {
  return normalizeTotpCode(raw) !== null;
}

/** A base32 TOTP secret is grouped into 4-char blocks for easier manual entry. */
export function formatTotpSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(" ");
}

/**
 * Reads the `aal` (authenticator assurance level) claim from a Supabase access
 * token without a network round-trip. Used by middleware to decide, from the
 * session it already has, whether the current session has cleared its second
 * factor — avoiding an extra `getUser` call per request. Returns `null` when the
 * token is absent or the claim is missing/unrecognized.
 */
export function decodeJwtAal(token: string | undefined | null): AuthAssuranceLevel | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    const claims = JSON.parse(json) as { aal?: unknown };
    return claims.aal === "aal1" || claims.aal === "aal2" ? claims.aal : null;
  } catch {
    return null;
  }
}
