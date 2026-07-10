// Enterprise RBAC — public surface.

export { ROLES, ROLE_RANK, ROLE_LABELS, ROLE_DESCRIPTIONS, isRole, atLeast, assignableRoles } from "./roles";
export type { Role } from "./roles";

export { PERMISSIONS, ROLE_PERMISSIONS, can } from "./permissions";
export type { Permission } from "./permissions";
