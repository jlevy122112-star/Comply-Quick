import { describe, it, expect } from "vitest";
import { ROLES, can, atLeast, assignableRoles, isRole, ROLE_PERMISSIONS, PERMISSIONS, type Role } from "@/lib/rbac";

describe("rbac roles", () => {
  it("recognizes valid roles and rejects others", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole("")).toBe(false);
  });

  it("orders the ladder owner > admin > manager > member > viewer", () => {
    expect(atLeast("owner", "admin")).toBe(true);
    expect(atLeast("admin", "owner")).toBe(false);
    expect(atLeast("manager", "manager")).toBe(true);
    expect(atLeast("viewer", "member")).toBe(false);
  });

  it("only lets an actor assign roles at or below their own", () => {
    expect(assignableRoles("admin")).toEqual(["admin", "manager", "member", "viewer"]);
    expect(assignableRoles("viewer")).toEqual(["viewer"]);
    expect(assignableRoles("owner")).toEqual([...ROLES]);
  });
});

describe("rbac permissions", () => {
  it("grants the owner every permission", () => {
    for (const p of PERMISSIONS) expect(can("owner", p)).toBe(true);
  });

  it("withholds org deletion from everyone but the owner", () => {
    expect(can("owner", "org:delete")).toBe(true);
    expect(can("admin", "org:delete")).toBe(false);
    expect(can("manager", "org:delete")).toBe(false);
  });

  it("lets admins manage members and SSO but not managers", () => {
    expect(can("admin", "member:role")).toBe(true);
    expect(can("admin", "sso:manage")).toBe(true);
    expect(can("manager", "member:role")).toBe(false);
    expect(can("manager", "sso:manage")).toBe(false);
  });

  it("gives viewers read-only access", () => {
    expect(can("viewer", "project:read")).toBe(true);
    expect(can("viewer", "project:create")).toBe(false);
    expect(can("viewer", "approval:decide")).toBe(false);
  });

  it("never grants a lower role a permission a higher role lacks", () => {
    const ladder: Role[] = ["viewer", "member", "manager", "admin", "owner"];
    for (const p of PERMISSIONS) {
      let seenGrant = false;
      for (const role of ladder) {
        const holds = ROLE_PERMISSIONS[role].has(p);
        if (holds) seenGrant = true;
        // Once a role grants p, every more-privileged role must also grant it.
        if (seenGrant) expect(ROLE_PERMISSIONS[role].has(p)).toBe(true);
      }
    }
  });
});
