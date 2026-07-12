import { NextRequest } from "next/server";
import { authenticateScim, scimErrorResponse, scimJson } from "@/lib/scim/http";
import { deleteScimUser, getScimUser, replaceScimUser, setScimUserActive } from "@/lib/scim/provisioning";
import { parseScimUser, parseActiveFromPatch, toScimResource } from "@/lib/scim/schema";

function userLocation(request: NextRequest, id: string): string {
  return new URL(`/api/scim/v2/Users/${id}`, request.nextUrl.origin).toString();
}

/** Fetches a single provisioned user. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateScim(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const user = await getScimUser(auth.organizationId, id);
  if (!user) return scimErrorResponse(404, "User not found.");
  return scimJson(toScimResource(user, userLocation(request, user.id)));
}

/** Replaces a user's attributes (full PUT). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateScim(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return scimErrorResponse(400, "Request body must be valid JSON.", "invalidSyntax");
  }
  const parsed = parseScimUser(body);
  if (!parsed.ok) return scimErrorResponse(400, parsed.detail, "invalidValue");

  const result = await replaceScimUser(auth.organizationId, id, parsed.value);
  if (!result.ok) {
    if (result.conflict) return scimErrorResponse(409, result.error, "uniqueness");
    return scimErrorResponse(result.error === "User not found." ? 404 : 500, result.error);
  }
  return scimJson(toScimResource(result.user, userLocation(request, result.user.id)));
}

/** Applies a partial update — used by IdPs to (de)activate users. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateScim(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return scimErrorResponse(400, "Request body must be valid JSON.", "invalidSyntax");
  }

  const active = parseActiveFromPatch(body);
  if (active === undefined) {
    // No supported attribute changed; echo the current resource unchanged.
    const user = await getScimUser(auth.organizationId, id);
    if (!user) return scimErrorResponse(404, "User not found.");
    return scimJson(toScimResource(user, userLocation(request, user.id)));
  }

  const result = await setScimUserActive(auth.organizationId, id, active);
  if (!result.ok) return scimErrorResponse(result.error === "User not found." ? 404 : 500, result.error);
  return scimJson(toScimResource(result.user, userLocation(request, result.user.id)));
}

/** Deprovisions (hard-deletes) a user. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateScim(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const ok = await deleteScimUser(auth.organizationId, id);
  if (!ok) return scimErrorResponse(500, "Could not delete user.");
  return new Response(null, { status: 204 });
}
