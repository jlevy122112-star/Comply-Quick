export const EMAIL_ACCESS_POLICIES = {
  legalReview: "LEGAL_REVIEW_ADMIN_EMAILS",
  pmfMetrics: "PMF_ADMIN_EMAILS",
} as const;

export type EmailAccessPolicy = keyof typeof EMAIL_ACCESS_POLICIES;

type Environment = Record<string, string | undefined>;

/** Normalizes a comma- or whitespace-separated email allowlist. */
export function parseEmailAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Denies access by default unless the normalized email is explicitly allowlisted. */
export function isEmailAllowed(email: string | null | undefined, raw: string | undefined): boolean {
  if (!email) return false;
  return parseEmailAllowlist(raw).includes(email.trim().toLowerCase());
}

/** Resolves a named server-side policy from its environment-backed allowlist. */
export function isEmailPolicyAllowed(
  policy: EmailAccessPolicy,
  email: string | null | undefined,
  environment: Environment
): boolean {
  return isEmailAllowed(email, environment[EMAIL_ACCESS_POLICIES[policy]]);
}
