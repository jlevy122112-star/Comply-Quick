// Enterprise RBAC — permission matrix.
//
// Permissions are fine-grained capabilities. Each role maps to the exact set it
// holds; `can` is the single source of truth for authorization decisions across
// server actions and UI gating. Keeping this a static, exhaustive matrix (rather
// than deriving from rank) makes every role's surface explicit and auditable.

import type { Role } from "./roles";

export const PERMISSIONS = [
  // Organization administration.
  "org:update", // rename / rebrand the organization
  "org:delete", // permanently delete the organization
  "org:billing", // view & manage subscription/billing
  "member:invite", // add a member
  "member:role", // change a member's role
  "member:remove", // remove a member
  "sso:manage", // configure SSO connections
  "scim:manage", // configure SCIM provisioning tokens
  // Workspace administration.
  "workspace:create",
  "workspace:update",
  "workspace:delete",
  // Project / compliance work.
  "project:create",
  "project:update",
  "project:delete",
  "approval:decide", // accept/reject human-in-the-loop proposals
  "project:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OWNER: Permission[] = [...PERMISSIONS];

const ADMIN: Permission[] = [
  "org:update",
  "org:billing",
  "member:invite",
  "member:role",
  "member:remove",
  "sso:manage",
  "scim:manage",
  "workspace:create",
  "workspace:update",
  "workspace:delete",
  "project:create",
  "project:update",
  "project:delete",
  "approval:decide",
  "project:read",
];

const MANAGER: Permission[] = [
  "workspace:create",
  "workspace:update",
  "project:create",
  "project:update",
  "project:delete",
  "approval:decide",
  "project:read",
];

const MEMBER: Permission[] = ["project:create", "project:update", "approval:decide", "project:read"];

const VIEWER: Permission[] = ["project:read"];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(OWNER),
  admin: new Set(ADMIN),
  manager: new Set(MANAGER),
  member: new Set(MEMBER),
  viewer: new Set(VIEWER),
};

/** Authorization decision: does `role` hold `permission`? */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
