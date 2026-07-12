// Shared HTTP plumbing for the SCIM endpoints: bearer authentication and
// `application/scim+json` response shaping.

import { NextResponse } from "next/server";
import { resolveScimToken } from "./tokens";
import { scimError } from "./schema";

const SCIM_CONTENT_TYPE = "application/scim+json";

/** JSON response with the SCIM content type. */
export function scimJson(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE, ...headers },
  });
}

/** SCIM error response with the standard Error schema body. */
export function scimErrorResponse(status: number, detail: string, scimType?: string): NextResponse {
  return scimJson(scimError(status, detail, scimType), status);
}

/** Extracts a bearer token from an Authorization header. */
export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

export type ScimAuth = { ok: true; organizationId: string } | { ok: false; response: NextResponse };

/**
 * Authenticates a SCIM request by bearer token. Returns the owning
 * organization id, or a ready-to-return 401 SCIM error response.
 */
export async function authenticateScim(request: Request): Promise<ScimAuth> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return { ok: false, response: scimErrorResponse(401, "A bearer token is required.") };
  }
  const resolved = await resolveScimToken(token);
  if (!resolved) {
    return { ok: false, response: scimErrorResponse(401, "Invalid or revoked bearer token.") };
  }
  return { ok: true, organizationId: resolved.organizationId };
}
