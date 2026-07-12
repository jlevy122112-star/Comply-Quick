import { describe, it, expect } from "vitest";
import {
  parseScimUser,
  parseActiveFromPatch,
  parseUserNameFilter,
  parsePagination,
  pickPrimaryEmail,
  toScimResource,
  toListResponse,
  scimError,
  SCIM_USER_SCHEMA,
  SCIM_LIST_RESPONSE_SCHEMA,
  SCIM_ERROR_SCHEMA,
  type ScimUserResource,
} from "@/lib/scim/schema";
import {
  SCIM_TOKEN_PREFIX,
  generateScimToken,
  hashScimToken,
  scimTokenPrefixOf,
  digestsEqual,
} from "@/lib/scim/tokens";

describe("scim token crypto", () => {
  it("generates prefixed tokens and stable hashes", () => {
    const token = generateScimToken();
    expect(token.startsWith(SCIM_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(20);
    expect(hashScimToken(token)).toBe(hashScimToken(token));
    expect(hashScimToken(token)).toHaveLength(64);
  });

  it("derives a non-secret display prefix", () => {
    const token = "scim_abcdefghijklmnop";
    expect(scimTokenPrefixOf(token)).toBe("scim_abcdefg");
    expect(scimTokenPrefixOf(token).length).toBe(12);
  });

  it("compares digests in constant time and rejects mismatches/length diffs", () => {
    const a = hashScimToken("one");
    const b = hashScimToken("one");
    const c = hashScimToken("two");
    expect(digestsEqual(a, b)).toBe(true);
    expect(digestsEqual(a, c)).toBe(false);
    expect(digestsEqual(a, "short")).toBe(false);
  });

  it("produces distinct tokens per call", () => {
    expect(generateScimToken()).not.toBe(generateScimToken());
  });
});

describe("parseScimUser", () => {
  it("requires userName", () => {
    const r = parseScimUser({ displayName: "No Name" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toMatch(/userName/);
  });

  it("rejects non-objects", () => {
    expect(parseScimUser(null).ok).toBe(false);
    expect(parseScimUser("nope").ok).toBe(false);
  });

  it("normalizes a full Okta-style payload", () => {
    const r = parseScimUser({
      userName: "jane@acme.com",
      externalId: "ext-1",
      displayName: "Jane Doe",
      name: { givenName: "Jane", familyName: "Doe" },
      emails: [{ value: "personal@x.com" }, { value: "jane@acme.com", primary: true }],
      active: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.userName).toBe("jane@acme.com");
      expect(r.value.externalId).toBe("ext-1");
      expect(r.value.email).toBe("jane@acme.com");
      expect(r.value.givenName).toBe("Jane");
      expect(r.value.familyName).toBe("Doe");
      expect(r.value.active).toBe(false);
    }
  });

  it("defaults active to true and falls back to userName as email", () => {
    const r = parseScimUser({ userName: "bob@acme.com" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.active).toBe(true);
      expect(r.value.email).toBe("bob@acme.com");
    }
  });

  it("does not invent an email from a non-email userName", () => {
    const r = parseScimUser({ userName: "bob" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBeNull();
  });
});

describe("pickPrimaryEmail", () => {
  it("prefers the primary, then the first", () => {
    expect(pickPrimaryEmail([{ value: "a@x.com" }, { value: "b@x.com", primary: true }])).toBe("b@x.com");
    expect(pickPrimaryEmail([{ value: "a@x.com" }, { value: "b@x.com" }])).toBe("a@x.com");
    expect(pickPrimaryEmail([])).toBeNull();
    expect(pickPrimaryEmail("nope")).toBeNull();
  });
});

describe("parseActiveFromPatch", () => {
  it("reads a pathed replace of active", () => {
    expect(parseActiveFromPatch({ Operations: [{ op: "replace", path: "active", value: false }] })).toBe(false);
    expect(parseActiveFromPatch({ Operations: [{ op: "Replace", path: "active", value: true }] })).toBe(true);
  });

  it("reads a bulk value object with no path (Azure style)", () => {
    expect(parseActiveFromPatch({ Operations: [{ op: "replace", value: { active: false } }] })).toBe(false);
  });

  it("coerces stringified booleans", () => {
    expect(parseActiveFromPatch({ Operations: [{ op: "replace", path: "active", value: "False" }] })).toBe(false);
    expect(parseActiveFromPatch({ Operations: [{ op: "replace", path: "active", value: "true" }] })).toBe(true);
  });

  it("returns undefined when no op touches active", () => {
    expect(parseActiveFromPatch({ Operations: [{ op: "replace", path: "displayName", value: "X" }] })).toBeUndefined();
    expect(parseActiveFromPatch({})).toBeUndefined();
    expect(parseActiveFromPatch(null)).toBeUndefined();
  });
});

describe("parseUserNameFilter", () => {
  it("extracts a userName eq filter", () => {
    expect(parseUserNameFilter('userName eq "jane@acme.com"')).toBe("jane@acme.com");
    expect(parseUserNameFilter('  userName   EQ   "x@y.com"  ')).toBe("x@y.com");
  });

  it("returns null for unsupported or empty filters", () => {
    expect(parseUserNameFilter('displayName eq "Jane"')).toBeNull();
    expect(parseUserNameFilter('userName sw "j"')).toBeNull();
    expect(parseUserNameFilter(null)).toBeNull();
    expect(parseUserNameFilter("")).toBeNull();
  });
});

describe("parsePagination", () => {
  it("defaults to offset 0 / limit 100", () => {
    expect(parsePagination(null, null)).toEqual({ offset: 0, limit: 100 });
  });

  it("converts 1-based startIndex to a 0-based offset", () => {
    expect(parsePagination("1", "50")).toEqual({ offset: 0, limit: 50 });
    expect(parsePagination("11", "10")).toEqual({ offset: 10, limit: 10 });
  });

  it("clamps count to 200 and guards junk input", () => {
    expect(parsePagination("0", "9999").limit).toBe(200);
    expect(parsePagination("-5", "abc")).toEqual({ offset: 0, limit: 100 });
  });
});

describe("SCIM resource shaping", () => {
  const user: ScimUserResource = {
    id: "u1",
    externalId: "ext-1",
    userName: "jane@acme.com",
    email: "jane@acme.com",
    displayName: "Jane Doe",
    givenName: "Jane",
    familyName: "Doe",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };

  it("serializes a User resource with schema, meta and emails", () => {
    const r = toScimResource(user, "https://app/api/scim/v2/Users/u1");
    expect(r.schemas).toEqual([SCIM_USER_SCHEMA]);
    expect(r.id).toBe("u1");
    expect(r.userName).toBe("jane@acme.com");
    expect(r.emails).toEqual([{ value: "jane@acme.com", primary: true }]);
    expect((r.meta as { location: string }).location).toBe("https://app/api/scim/v2/Users/u1");
    expect((r.meta as { resourceType: string }).resourceType).toBe("User");
  });

  it("omits emails and name when absent", () => {
    const r = toScimResource(
      { ...user, email: null, givenName: null, familyName: null },
      "https://app/api/scim/v2/Users/u1"
    );
    expect(r.emails).toBeUndefined();
    expect(r.name).toBeUndefined();
  });

  it("builds a ListResponse envelope", () => {
    const list = toListResponse([toScimResource(user, "loc")], 5, 1);
    expect(list.schemas).toEqual([SCIM_LIST_RESPONSE_SCHEMA]);
    expect(list.totalResults).toBe(5);
    expect(list.startIndex).toBe(1);
    expect(list.itemsPerPage).toBe(1);
    expect((list.Resources as unknown[]).length).toBe(1);
  });

  it("builds a SCIM Error object with string status", () => {
    const err = scimError(409, "userName already exists.", "uniqueness");
    expect(err.schemas).toEqual([SCIM_ERROR_SCHEMA]);
    expect(err.status).toBe("409");
    expect(err.scimType).toBe("uniqueness");
    expect(err.detail).toBe("userName already exists.");
  });
});
