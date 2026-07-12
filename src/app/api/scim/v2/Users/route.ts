import { NextRequest } from "next/server";
import { authenticateScim, scimErrorResponse, scimJson } from "@/lib/scim/http";
import { createScimUser, listScimUsers } from "@/lib/scim/provisioning";
import { parseScimUser, parseUserNameFilter, parsePagination, toScimResource, toListResponse } from "@/lib/scim/schema";

function userLocation(request: NextRequest, id: string): string {
  return new URL(`/api/scim/v2/Users/${id}`, request.nextUrl.origin).toString();
}

/** Lists provisioned users, optionally filtered by `userName eq`. */
export async function GET(request: NextRequest) {
  const auth = await authenticateScim(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const userName = parseUserNameFilter(params.get("filter"));
  const { offset, limit } = parsePagination(params.get("startIndex"), params.get("count"));

  const { users, total } = await listScimUsers(auth.organizationId, { userName, offset, limit });
  const resources = users.map((u) => toScimResource(u, userLocation(request, u.id)));
  return scimJson(toListResponse(resources, total, offset + 1));
}

/** Creates (provisions) a new user. */
export async function POST(request: NextRequest) {
  const auth = await authenticateScim(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return scimErrorResponse(400, "Request body must be valid JSON.", "invalidSyntax");
  }

  const parsed = parseScimUser(body);
  if (!parsed.ok) return scimErrorResponse(400, parsed.detail, "invalidValue");

  const result = await createScimUser(auth.organizationId, parsed.value);
  if (!result.ok) {
    if (result.conflict) return scimErrorResponse(409, result.error, "uniqueness");
    return scimErrorResponse(500, result.error);
  }
  return scimJson(toScimResource(result.user, userLocation(request, result.user.id)), 201);
}
