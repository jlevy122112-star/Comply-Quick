export const AGENCY_ROLES = ["owner", "admin", "account_manager", "client_viewer"] as const;

export type AgencyRole = (typeof AGENCY_ROLES)[number];

export const AGENCY_ROLE_RANK: Record<AgencyRole, number> = {
  owner: 3,
  admin: 3,
  account_manager: 2,
  client_viewer: 1,
};

export const AGENCY_ROLE_LABELS: Record<AgencyRole, string> = {
  owner: "Agency Admin",
  admin: "Agency Admin",
  account_manager: "Account Manager",
  client_viewer: "Client Viewer",
};

export const AGENCY_ROLE_DESCRIPTIONS: Record<AgencyRole, string> = {
  owner: "Full agency control, including billing, settings, members, and client onboarding.",
  admin: "Full agency control, including billing, settings, members, and client onboarding.",
  account_manager: "Manage clients and onboarding, and view portfolio analytics.",
  client_viewer: "Read-only access to client workspaces and portfolio analytics.",
};

export const AGENCY_CAPABILITIES = ["manage_agency", "manage_clients", "view_portfolio"] as const;
export type AgencyCapability = (typeof AGENCY_CAPABILITIES)[number];

export const AGENCY_ROLE_CAPABILITIES: Record<AgencyRole, ReadonlySet<AgencyCapability>> = {
  owner: new Set(AGENCY_CAPABILITIES),
  admin: new Set(AGENCY_CAPABILITIES),
  account_manager: new Set(["manage_clients", "view_portfolio"]),
  client_viewer: new Set(["view_portfolio"]),
};

export function canonicalAgencyRole(role: string): AgencyRole {
  return role === "owner" || role === "admin" || role === "account_manager" || role === "client_viewer"
    ? role
    : "client_viewer";
}

export function canAgency(role: AgencyRole, capability: AgencyCapability): boolean {
  return AGENCY_ROLE_CAPABILITIES[role].has(capability);
}

export function assignableAgencyRoles(actor: AgencyRole): AgencyRole[] {
  return AGENCY_ROLES.filter((role) => role !== "owner" && AGENCY_ROLE_RANK[role] <= AGENCY_ROLE_RANK[actor]);
}
