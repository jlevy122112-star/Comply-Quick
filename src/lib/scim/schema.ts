// SCIM 2.0 schema helpers — pure resource mapping, request parsing, and error
// shaping (RFC 7643/7644). Kept free of I/O so the protocol logic is unit-tested
// without a database or network.

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_RESPONSE_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_PATCH_OP_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
export const SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";

/** Normalized SCIM user fields extracted from an inbound request body. */
export interface ScimUserInput {
  userName: string;
  externalId: string | null;
  email: string | null;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  active: boolean;
}

/** A stored SCIM user, as the provisioning data layer returns it. */
export interface ScimUserResource {
  id: string;
  externalId: string | null;
  userName: string;
  email: string | null;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; detail: string };

interface ScimName {
  givenName?: unknown;
  familyName?: unknown;
}
interface ScimEmail {
  value?: unknown;
  primary?: unknown;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, 320) : null;
}

/** Picks the primary email (or the first) from a SCIM `emails` array. */
export function pickPrimaryEmail(emails: unknown): string | null {
  if (!Array.isArray(emails) || emails.length === 0) return null;
  const list = emails as ScimEmail[];
  const primary = list.find((e) => e && e.primary === true && typeof e.value === "string");
  const chosen = primary ?? list.find((e) => e && typeof e.value === "string");
  return chosen ? str(chosen.value) : null;
}

/**
 * Validates and normalizes an inbound SCIM User body (POST/PUT). `userName` is
 * the only strictly required attribute; `active` defaults to true when absent.
 */
export function parseScimUser(raw: unknown): ParseResult<ScimUserInput> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, detail: "Request body must be a SCIM User object." };
  }
  const body = raw as Record<string, unknown>;

  const userName = str(body.userName);
  if (!userName) return { ok: false, detail: "userName is required." };

  const name = (typeof body.name === "object" && body.name !== null ? body.name : {}) as ScimName;
  const email = pickPrimaryEmail(body.emails) ?? (userName.includes("@") ? userName : null);

  return {
    ok: true,
    value: {
      userName,
      externalId: str(body.externalId),
      email,
      displayName: str(body.displayName),
      givenName: str(name.givenName),
      familyName: str(name.familyName),
      active: body.active === undefined ? true : coerceBool(body.active),
    },
  };
}

interface PatchOperation {
  op?: unknown;
  path?: unknown;
  value?: unknown;
}

/**
 * Extracts the desired `active` state from a SCIM PatchOp. IdPs deprovision by
 * sending `replace` on the `active` attribute (either as a pathed op with a
 * boolean value, or as a bulk `{ active: false }` value object). Returns
 * undefined when no operation touches `active`.
 */
export function parseActiveFromPatch(raw: unknown): boolean | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const ops = (raw as { Operations?: unknown }).Operations;
  if (!Array.isArray(ops)) return undefined;

  let result: boolean | undefined;
  for (const op of ops as PatchOperation[]) {
    if (!op || typeof op !== "object") continue;
    const verb = typeof op.op === "string" ? op.op.toLowerCase() : "";
    if (verb !== "replace" && verb !== "add") continue;
    const path = typeof op.path === "string" ? op.path.toLowerCase() : "";

    if (path === "active") {
      result = coerceBool(op.value);
    } else if (!path && typeof op.value === "object" && op.value !== null) {
      const v = (op.value as Record<string, unknown>).active;
      if (v !== undefined) result = coerceBool(v);
    }
  }
  return result;
}

function coerceBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return Boolean(value);
}

/**
 * Parses a SCIM `filter` query into a supported equality clause. Only
 * `userName eq "value"` is supported (the filter Okta/Azure send when checking
 * whether a user already exists); anything else returns null so the caller can
 * fall back to an unfiltered list.
 */
export function parseUserNameFilter(filter: string | null | undefined): string | null {
  if (!filter) return null;
  const m = /^\s*userName\s+eq\s+"([^"]*)"\s*$/i.exec(filter);
  return m ? m[1] : null;
}

/** Clamps SCIM pagination params to sane bounds. `startIndex` is 1-based. */
export function parsePagination(startIndex: string | null, count: string | null): { offset: number; limit: number } {
  const si = startIndex ? Number(startIndex) : NaN;
  const c = count ? Number(count) : NaN;
  const start = Number.isFinite(si) && si >= 1 ? Math.floor(si) : 1;
  const limit = Number.isFinite(c) && c >= 0 ? Math.min(Math.floor(c), 200) : 100;
  return { offset: start - 1, limit };
}

/** Serializes a stored user to a SCIM User resource. */
export function toScimResource(user: ScimUserResource, location: string): Record<string, unknown> {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.id,
    externalId: user.externalId ?? undefined,
    userName: user.userName,
    name:
      user.givenName || user.familyName
        ? { givenName: user.givenName ?? undefined, familyName: user.familyName ?? undefined }
        : undefined,
    displayName: user.displayName ?? undefined,
    emails: user.email ? [{ value: user.email, primary: true }] : undefined,
    active: user.active,
    meta: {
      resourceType: "User",
      created: user.createdAt,
      lastModified: user.updatedAt,
      location,
    },
  };
}

/** Builds a SCIM ListResponse envelope. */
export function toListResponse(
  resources: Record<string, unknown>[],
  totalResults: number,
  startIndex: number
): Record<string, unknown> {
  return {
    schemas: [SCIM_LIST_RESPONSE_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
}

/** Builds a SCIM Error object. */
export function scimError(status: number, detail: string, scimType?: string): Record<string, unknown> {
  return {
    schemas: [SCIM_ERROR_SCHEMA],
    status: String(status),
    ...(scimType ? { scimType } : {}),
    detail,
  };
}
