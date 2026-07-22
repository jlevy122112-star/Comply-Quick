// GitHub OAuth state management.
//
// The state parameter encodes the organization the user selected plus a random
// nonce, signed with CRON_SECRET so the callback can trust it. This prevents
// CSRF and lets us avoid a server-side session store for the OAuth handshake.

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const SEPARATOR = ":";
const VERSION = "v1";

export function signState(secret: string, organizationId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${VERSION}${SEPARATOR}${organizationId}${SEPARATOR}${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return `${payload}${SEPARATOR}${sig}`;
}

export function verifyState(secret: string, state: string): string | null {
  const parts = state.split(SEPARATOR);
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, organizationId, nonce, sig] = parts;
  const payload = `${VERSION}${SEPARATOR}${organizationId}${SEPARATOR}${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  return organizationId;
}
