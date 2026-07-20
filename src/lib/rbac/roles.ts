// Enterprise RBAC — role definitions.
//
// A single ordered role ladder is used for both organizations and workspaces.
// Roles are ranked so a coarse "at least this role" check is a numeric compare,
// while fine-grained gating goes through the permission matrix (./permissions).

export const ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;

export type Role = (typeof ROLES)[number];

// Higher rank = more authority. Used by `atLeast` for hierarchical checks.
export const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
  viewer: 0,
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including billing, SSO, and deleting the organization.",
  admin: "Manage members, workspaces, and settings. Cannot delete the org.",
  manager: "Create and manage workspaces and projects within them.",
  member: "Work inside assigned workspaces and projects.",
  viewer: "Read-only access to shared workspaces and projects.",
};

/** Agency-facing labels for the generic role ladder.
 *  Maps the RBAC layer to the names requested by enterprise/agency customers.
 */
export const AGENCY_ROLE_LABELS: Record<Role, string> = {
  owner: "Agency Owner",
  admin: "Agency Admin",
  manager: "Account Manager",
  member: "Member",
  viewer: "Client Viewer",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** True when `role` is at least as privileged as `min` on the ladder. */
export function atLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Roles a holder of `actor` is allowed to assign to others (never above self). */
export function assignableRoles(actor: Role): Role[] {
  return ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[actor]);
}

/** Returns the agency-facing label for a role, falling back to the generic label. */
export function agencyRoleLabel(role: Role): string {
  return AGENCY_ROLE_LABELS[role] ?? ROLE_LABELS[role];
}
