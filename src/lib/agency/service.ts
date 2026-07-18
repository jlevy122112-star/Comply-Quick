// Agency Client Portal server service (Phase 5).
//
// Multi-tenant glue on top of the per-user app. An Agency/Enterprise user owns
// exactly one `agency` workspace (created on demand), under which they manage
// client profiles, white-label branding, and custom domains. All reads/writes
// go through the RLS-scoped server client; the tenant resolver (public landing
// on a custom domain) uses the admin client since there is no session yet.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/entitlements";
import { logger } from "@/services";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/services/errors";
import { getDomainProvider, type DomainVerification } from "./domain-provider";
import { TIER_CONFIG, isUnlimited, managedClientLimit } from "@/lib/pricing";
import { slugify as organizationSlugify } from "@/lib/organizations-db";
import type { Organization } from "@/lib/organizations-db";
import {
  AGENCY_ROLE_DESCRIPTIONS,
  AGENCY_ROLE_LABELS,
  assignableAgencyRoles,
  canAgency,
  canonicalAgencyRole,
  type AgencyCapability,
  type AgencyRole,
} from "./roles";

const log = logger.child({ module: "agency" });

export interface AgencyBranding {
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
}

export interface Agency extends AgencyBranding {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface AgencyClient {
  id: string;
  agencyId: string;
  name: string;
  contactEmail: string | null;
  websiteUrl: string | null;
  notes: string;
  status: "active" | "archived";
  organizationId: string | null;
  createdAt: string;
}

export interface AgencyClientAssignment {
  userId: string;
  email: string | null;
  createdAt: string;
}

export interface AgencyDomain {
  id: string;
  agencyId: string;
  domain: string;
  status: "pending" | "verified" | "error";
  verificationToken: string;
  provider: string | null;
  dns: DomainVerification[];
  verifiedAt: string | null;
  createdAt: string;
}

const AGENCY_COLS = "id, owner_id, name, slug, logo_url, primary_color, support_email, created_at";
const CLIENT_COLS = "id, agency_id, name, contact_email, website_url, notes, status, organization_id, created_at";
const DOMAIN_COLS = "id, agency_id, domain, status, verification_token, provider, dns, verified_at, created_at";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function mapAgency(row: Record<string, unknown>): Agency {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    slug: row.slug as string,
    logoUrl: (row.logo_url as string | null) ?? null,
    primaryColor: (row.primary_color as string) ?? "#4f46e5",
    supportEmail: (row.support_email as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    slug: row.slug as string,
    plan: (row.plan as Organization["plan"]) ?? "team",
    createdAt: row.created_at as string,
  };
}

function mapClient(row: Record<string, unknown>): AgencyClient {
  return {
    id: row.id as string,
    agencyId: row.agency_id as string,
    name: row.name as string,
    contactEmail: (row.contact_email as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    status: (row.status as AgencyClient["status"]) ?? "active",
    organizationId: (row.organization_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapDomain(row: Record<string, unknown>): AgencyDomain {
  return {
    id: row.id as string,
    agencyId: row.agency_id as string,
    domain: row.domain as string,
    status: (row.status as AgencyDomain["status"]) ?? "pending",
    verificationToken: row.verification_token as string,
    provider: (row.provider as string | null) ?? null,
    dns: (row.dns as DomainVerification[] | null) ?? [],
    verifiedAt: (row.verified_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Whether the current user may use the Agency portal (agency/enterprise tier). */
export async function canUseAgencyPortal(): Promise<boolean> {
  const entitlement = await getEntitlement();
  return entitlement.isPremium && (entitlement.tier === "agency" || entitlement.tier === "enterprise");
}

/** Turns an agency name into a URL-safe, reasonably-unique slug seed. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "agency";
}

/**
 * Returns the caller's agency workspace, creating it on first access. Paid-plan gated
 * (agency/enterprise). The owner is also inserted as an `owner` member row so
 * membership checks are uniform.
 *
 * Wrapped in React `cache` so the several callers that run per request (the
 * portal page and each list helper below all resolve the agency first) share a
 * single invocation instead of racing to create the row in parallel.
 */
export const getOrCreateAgency = cache(async (): Promise<Agency> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  if (!(await canUseAgencyPortal())) {
    throw new ForbiddenError("The client portal is available on the Agency and Enterprise plans.");
  }

  const owned = async () => supabase.from("agencies").select(AGENCY_COLS).eq("owner_id", user.id).maybeSingle();

  const existing = await owned();
  if (existing.data) return mapAgency(existing.data);

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership?.agency_id) {
    const { data: memberAgency } = await supabase
      .from("agencies")
      .select(AGENCY_COLS)
      .eq("id", membership.agency_id)
      .maybeSingle();
    if (memberAgency) return mapAgency(memberAgency);
  }

  // Derive a slug and create the workspace. Each user owns at most one agency
  // (unique owner_id), so a duplicate-key error means either a concurrent
  // create won the race (from another request/tab) or the slug clashed with a
  // different owner. Re-read our own row to tell them apart: if it now exists,
  // use it; otherwise the slug clashed, so retry with a fresh suffix.
  const seed = slugify(user.email?.split("@")[0] ?? "agency");
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("agencies")
      .insert({ owner_id: user.id, name: "My Agency", slug: candidate })
      .select(AGENCY_COLS)
      .single();
    if (!error && data) {
      await supabase.from("agency_members").insert({ agency_id: data.id, user_id: user.id, role: "owner" });
      log.info("Created agency workspace", { agencyId: data.id, slug: candidate });
      return mapAgency(data);
    }
    if (!error?.message.toLowerCase().includes("duplicate")) {
      log.error("Failed to create agency", { error: error?.message });
      throw new Error("Could not create agency workspace.");
    }
    const mine = await owned();
    if (mine.data) return mapAgency(mine.data);
  }
  throw new Error(`Could not allocate a unique agency slug (seed: ${seed}).`);
});

interface BrandingUpdate {
  name?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  supportEmail?: string | null;
}

/** Updates white-label branding for the caller's agency. Owner-scoped by RLS. */
export async function updateBranding(patch: BrandingUpdate): Promise<Agency> {
  const { agency } = await requireAgencyCapability("manage_agency");
  const supabase = await createClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length === 0 || name.length > 80) throw new ValidationError("Agency name must be 1–80 characters.");
    update.name = name;
  }
  if (patch.primaryColor !== undefined) {
    if (!HEX_COLOR.test(patch.primaryColor)) throw new ValidationError("Color must be a hex value like #4f46e5.");
    update.primary_color = patch.primaryColor;
  }
  if (patch.logoUrl !== undefined) update.logo_url = patch.logoUrl?.trim() || null;
  if (patch.supportEmail !== undefined) update.support_email = patch.supportEmail?.trim() || null;

  const { data, error } = await supabase
    .from("agencies")
    .update(update)
    .eq("id", agency.id)
    .select(AGENCY_COLS)
    .single();
  if (error || !data) {
    log.error("Failed to update branding", { error: error?.message });
    throw new Error("Could not update branding.");
  }
  return mapAgency(data);
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function listClients(): Promise<AgencyClient[]> {
  const access = await getAgencyAccess();
  const supabase = await createClient();
  let query = supabase
    .from("agency_clients")
    .select(CLIENT_COLS)
    .eq("agency_id", access.agency.id)
    .order("created_at", { ascending: false });
  if (access.role === "account_manager") {
    const { data: assignments } = await supabase
      .from("agency_client_account_managers")
      .select("client_id")
      .eq("agency_id", access.agency.id)
      .eq("user_id", access.userId);
    const clientIds = (assignments ?? []).map((row) => row.client_id as string);
    if (clientIds.length === 0) return [];
    query = query.in("id", clientIds);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapClient);
}

/** Fetches one client owned by the caller's agency, or null if not found. */
export async function getClient(id: string): Promise<AgencyClient | null> {
  const access = await getAgencyAccess();
  if (access.role === "account_manager") await assertAssignedClient(id, access);
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_clients")
    .select(CLIENT_COLS)
    .eq("id", id)
    .eq("agency_id", access.agency.id)
    .maybeSingle();
  return data ? mapClient(data) : null;
}

interface ClientInput {
  name: string;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  notes?: string;
}

export async function createClient_(input: ClientInput): Promise<AgencyClient> {
  const access = await requireAgencyCapability("manage_clients");
  const { agency } = access;
  const supabase = await createClient();
  const name = input.name.trim();
  if (name.length === 0 || name.length > 120) throw new ValidationError("Client name must be 1–120 characters.");

  const entitlement = await getEntitlement();
  const clientLimit = managedClientLimit(entitlement.tier);
  if (clientLimit !== null && !isUnlimited(clientLimit)) {
    const { count, error: countError } = await supabase
      .from("agency_clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id)
      .eq("status", "active");
    if (countError) {
      log.error("Failed to count agency clients", { error: countError.message });
      throw new Error("Could not verify the client limit.");
    }
    if ((count ?? 0) >= clientLimit) {
      throw new ValidationError(
        `Your ${TIER_CONFIG[entitlement.tier].label} plan includes ${clientLimit} managed clients. Archive a client or upgrade to add more.`
      );
    }
  }

  const { data, error } = await supabase
    .from("agency_clients")
    .insert({
      agency_id: agency.id,
      name,
      contact_email: input.contactEmail?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      notes: input.notes?.trim() || "",
    })
    .select(CLIENT_COLS)
    .single();
  if (error || !data) {
    log.error("Failed to create client", { error: error?.message });
    throw new Error("Could not create client.");
  }
  const client = mapClient(data);
  if (access.role === "account_manager") {
    const { error: assignmentError } = await createAdminClient().from("agency_client_account_managers").insert({
      agency_id: agency.id,
      client_id: client.id,
      user_id: access.userId,
      assigned_by: access.userId,
    });
    if (assignmentError) {
      log.error("Failed to assign new client to account manager", { error: assignmentError.message });
      throw new Error("Could not assign the new client.");
    }
  }
  return client;
}

async function resolveAgencyOwnerPersonalOrganization(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string
): Promise<string | null> {
  const { data: personalOrganization, error } = await admin
    .from("organizations")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("is_personal", true)
    .maybeSingle();
  if (error) {
    log.error("Failed to resolve the agency owner's personal organization", {
      error: error.message,
    });
    throw new Error("Could not migrate the client's historical data.");
  }
  return (personalOrganization?.id as string | undefined) ?? null;
}

async function migrateClientHistoricalData(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  clientId: string,
  organizationId: string,
  personalOrganizationId: string | null
): Promise<void> {
  const organizationFilter = personalOrganizationId
    ? `organization_id.eq.${personalOrganizationId},organization_id.is.null,organization_id.eq.${organizationId}`
    : `organization_id.is.null,organization_id.eq.${organizationId}`;
  const historicalOrganizationFilter = personalOrganizationId
    ? `organization_id.eq.${personalOrganizationId},organization_id.is.null`
    : "organization_id.is.null";
  const { data: clientProjects, error: projectLookupError } = await admin
    .from("projects")
    .select("id")
    .eq("user_id", ownerId)
    .eq("client_id", clientId)
    .or(organizationFilter);
  if (projectLookupError) {
    log.error("Failed to find historical client projects", { error: projectLookupError.message });
    throw new Error("Could not migrate the client's historical data.");
  }
  const projectIds = (clientProjects ?? []).map((project) => project.id as string);
  if (projectIds.length === 0) return;

  const { error: projectTagError } = await admin
    .from("projects")
    .update({ organization_id: organizationId })
    .in("id", projectIds)
    .eq("user_id", ownerId)
    .eq("client_id", clientId)
    .or(historicalOrganizationFilter);
  if (projectTagError) {
    log.error("Failed to tag historical client projects", { error: projectTagError.message });
    throw new Error("Could not migrate the client's historical data.");
  }

  const { error: findingTagError } = await admin
    .from("findings")
    .update({ organization_id: organizationId })
    .in("project_id", projectIds)
    .eq("user_id", ownerId)
    .or(historicalOrganizationFilter);
  if (findingTagError) {
    log.error("Failed to tag historical client findings", { error: findingTagError.message });
    throw new Error("Could not migrate the client's historical data.");
  }

  const { error: evidenceTagError } = await admin
    .from("evidence_records")
    .update({ organization_id: organizationId })
    .in("project_id", projectIds)
    .eq("user_id", ownerId)
    .or(historicalOrganizationFilter);
  if (evidenceTagError) {
    log.error("Failed to tag historical client evidence", { error: evidenceTagError.message });
    throw new Error("Could not migrate the client's historical data.");
  }
}

/** Provisions the linked organization and default workspace for an agency client. */
export async function provisionClientOrganization(clientId: string): Promise<Organization> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  if (!(await canUseAgencyPortal())) {
    throw new ForbiddenError("The client portal is available on the Agency and Enterprise plans.");
  }
  const access = await requireAgencyCapability(
    "manage_clients",
    "Only agency owners and admins, or assigned Account Managers, can provision client workspaces."
  );
  const { agency } = access;
  await assertAssignedClient(clientId, access);

  const { data: client, error: clientError } = await supabase
    .from("agency_clients")
    .select(CLIENT_COLS)
    .eq("id", clientId)
    .eq("agency_id", agency.id)
    .maybeSingle();
  if (clientError || !client) throw new NotFoundError("Client not found.");
  const admin = createAdminClient();
  if (client.organization_id) {
    const { data: existing } = await admin
      .from("organizations")
      .select("*")
      .eq("id", client.organization_id)
      .maybeSingle();
    if (existing) {
      try {
        const personalOrganizationId = await resolveAgencyOwnerPersonalOrganization(admin, agency.ownerId);
        await migrateClientHistoricalData(
          admin,
          agency.ownerId,
          client.id,
          client.organization_id,
          personalOrganizationId
        );
      } catch (error) {
        log.error("Failed to complete historical client migration during organization reuse", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return mapOrganization(existing);
    }
  }

  const personalOrganizationId = await resolveAgencyOwnerPersonalOrganization(admin, agency.ownerId);
  const slug = `${organizationSlugify(client.name)}-${client.id.slice(0, 6)}`;
  let { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({
      owner_id: agency.ownerId,
      name: client.name.trim().slice(0, 120),
      slug,
      plan: "team",
      is_personal: false,
    })
    .select("*")
    .single();

  if (organizationError?.code === "23505") {
    const existing = await admin.from("organizations").select("*").eq("slug", slug).maybeSingle();
    organization = existing.data;
    organizationError = existing.error;
  }
  if (organizationError || !organization) {
    log.error("Failed to provision client organization", { error: organizationError?.message });
    throw new Error("Could not provision the client workspace.");
  }

  await admin
    .from("organization_members")
    .upsert(
      { organization_id: organization.id, user_id: agency.ownerId, role: "owner" },
      { onConflict: "organization_id,user_id" }
    );
  if (user.id !== agency.ownerId) {
    await admin
      .from("organization_members")
      .upsert(
        { organization_id: organization.id, user_id: user.id, role: "admin" },
        { onConflict: "organization_id,user_id" }
      );
  }
  const { error: workspaceError } = await admin.from("workspaces").upsert(
    {
      organization_id: organization.id,
      name: `${client.name.trim().slice(0, 100)} Workspace`,
      slug: "default",
    },
    { onConflict: "organization_id,slug" }
  );
  if (workspaceError) {
    log.error("Failed to provision client workspace", { error: workspaceError.message });
    throw new Error("Could not provision the client workspace.");
  }

  const { data: linked, error: linkError } = await supabase
    .from("agency_clients")
    .update({ organization_id: organization.id, updated_at: new Date().toISOString() })
    .eq("id", client.id)
    .eq("agency_id", agency.id)
    .is("organization_id", null)
    .select(CLIENT_COLS)
    .maybeSingle();
  if (linkError) {
    log.error("Failed to link client organization", { error: linkError.message });
    throw new Error("Could not link the client workspace.");
  }
  if (!linked) {
    const { data: raced } = await supabase
      .from("agency_clients")
      .select("organization_id")
      .eq("id", client.id)
      .eq("agency_id", agency.id)
      .maybeSingle();
    if (raced?.organization_id && raced.organization_id !== organization.id) {
      await admin.from("organizations").delete().eq("id", organization.id);
      const { data: racedOrganization } = await admin
        .from("organizations")
        .select("*")
        .eq("id", raced.organization_id)
        .maybeSingle();
      if (racedOrganization) return mapOrganization(racedOrganization);
      return mapOrganization({ ...organization, id: raced.organization_id });
    }
    return mapOrganization(organization);
  }

  await migrateClientHistoricalData(admin, agency.ownerId, client.id, organization.id, personalOrganizationId);

  return mapOrganization(organization);
}

export async function updateClient(
  id: string,
  patch: Partial<ClientInput> & { status?: AgencyClient["status"] }
): Promise<AgencyClient> {
  const access = await requireAgencyCapability("manage_clients");
  const { agency } = access;
  await assertAssignedClient(id, access);
  const supabase = await createClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length === 0 || name.length > 120) throw new ValidationError("Client name must be 1–120 characters.");
    update.name = name;
  }
  if (patch.contactEmail !== undefined) update.contact_email = patch.contactEmail?.trim() || null;
  if (patch.websiteUrl !== undefined) update.website_url = patch.websiteUrl?.trim() || null;
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || "";
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await supabase
    .from("agency_clients")
    .update(update)
    .eq("id", id)
    .eq("agency_id", agency.id)
    .select(CLIENT_COLS)
    .maybeSingle();
  if (error) {
    log.error("Failed to update client", { error: error.message });
    throw new Error("Could not update client.");
  }
  if (!data) throw new NotFoundError("Client not found.");
  return mapClient(data);
}

export async function deleteClient(id: string): Promise<boolean> {
  const access = await requireAgencyCapability("manage_clients");
  const { agency } = access;
  await assertAssignedClient(id, access);
  const supabase = await createClient();
  const { error } = await supabase.from("agency_clients").delete().eq("id", id).eq("agency_id", agency.id);
  return !error;
}

export interface ClientStats {
  monitors: number;
  projects: number;
  /** Lowest last-known monitor score across the client's monitors (worst signal). */
  lowestScore: number | null;
}

/**
 * Per-client rollup of the agency owner's monitors/projects. Client data is just
 * a filtered view of the owner's own rows (they remain owned by the agency user),
 * so use the admin client just like portfolio analytics does.
 */
export async function getClientStats(): Promise<Record<string, ClientStats>> {
  const access = await getAgencyAccess();
  const agency = access.agency;
  const admin = createAdminClient();

  const stats: Record<string, ClientStats> = {};
  const ensure = (id: string) => (stats[id] ??= { monitors: 0, projects: 0, lowestScore: null });

  const { data: monitors } = await admin
    .from("scan_monitors")
    .select("client_id, last_score")
    .eq("user_id", agency.ownerId)
    .not("client_id", "is", null);
  for (const row of monitors ?? []) {
    const cid = row.client_id as string;
    const s = ensure(cid);
    s.monitors += 1;
    const score = row.last_score as number | null;
    if (score !== null && (s.lowestScore === null || score < s.lowestScore)) s.lowestScore = score;
  }

  const { data: projects } = await admin
    .from("projects")
    .select("client_id")
    .eq("user_id", agency.ownerId)
    .not("client_id", "is", null);
  for (const row of projects ?? []) ensure(row.client_id as string).projects += 1;

  // Only surface stats for clients that belong to this agency.
  const { data: clientIds } = await admin.from("agency_clients").select("id").eq("agency_id", agency.id);
  const valid = new Set((clientIds ?? []).map((c) => c.id as string));
  const assigned = await assignedClientIds(access);
  if (assigned) {
    for (const id of valid) if (!assigned.has(id)) valid.delete(id);
  }
  for (const id of Object.keys(stats)) if (!valid.has(id)) delete stats[id];

  return stats;
}

// ─── Team seats (members) ──────────────────────────────────────────────────────

export interface AgencyMember {
  id: string;
  agencyId: string;
  userId: string;
  email: string | null;
  role: AgencyRole | "member";
  roleLabel: string;
  roleDescription: string;
  createdAt: string;
}

const MEMBER_COLS = "id, agency_id, user_id, role, created_at";

function mapMember(row: Record<string, unknown>, email: string | null): AgencyMember {
  const role = (row.role as AgencyMember["role"]) ?? "member";
  const canonicalRole = canonicalAgencyRole(role);
  return {
    id: row.id as string,
    agencyId: row.agency_id as string,
    userId: row.user_id as string,
    email,
    role,
    roleLabel: AGENCY_ROLE_LABELS[canonicalRole],
    roleDescription: AGENCY_ROLE_DESCRIPTIONS[canonicalRole],
    createdAt: row.created_at as string,
  };
}

export interface AgencyAccess {
  agency: Agency;
  userId: string;
  role: AgencyRole;
  assignableRoles: AgencyRole[];
}

export async function getAgencyAccess(): Promise<AgencyAccess> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  if (user.id === agency.ownerId) {
    return { agency, userId: user.id, role: "owner", assignableRoles: assignableAgencyRoles("owner") };
  }
  const { data: membership } = await supabase
    .from("agency_members")
    .select("role")
    .eq("agency_id", agency.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) throw new ForbiddenError("You are not a member of this agency.");
  const role = canonicalAgencyRole(membership.role as string);
  return { agency, userId: user.id, role, assignableRoles: assignableAgencyRoles(role) };
}

async function requireAgencyCapability(
  capability: AgencyCapability,
  deniedMessage = "You do not have permission to perform this agency action."
): Promise<AgencyAccess> {
  const access = await getAgencyAccess();
  if (!canAgency(access.role, capability)) {
    throw new ForbiddenError(deniedMessage);
  }
  return access;
}

async function assignedClientIds(access: AgencyAccess): Promise<Set<string> | null> {
  if (access.role !== "account_manager") return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_client_account_managers")
    .select("client_id")
    .eq("agency_id", access.agency.id)
    .eq("user_id", access.userId);
  return new Set((data ?? []).map((row) => row.client_id as string));
}

async function assertAssignedClient(clientId: string, access: AgencyAccess): Promise<void> {
  if (access.role !== "account_manager") return;
  const ids = await assignedClientIds(access);
  if (!ids?.has(clientId)) throw new ForbiddenError("You are not assigned to this client.");
}

export async function listClientAssignments(clientId: string): Promise<AgencyClientAssignment[]> {
  const access = await getAgencyAccess();
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("agency_clients")
    .select("id")
    .eq("id", clientId)
    .eq("agency_id", access.agency.id)
    .maybeSingle();
  if (!client) throw new NotFoundError("Client not found.");
  const { data, error } = await supabase
    .from("agency_client_account_managers")
    .select("user_id, created_at")
    .eq("agency_id", access.agency.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const admin = createAdminClient();
  const assignments = await Promise.all(
    data.map(async (row) => {
      const { data: user } = await admin.auth.admin.getUserById(row.user_id as string);
      return {
        userId: row.user_id as string,
        email: user.user?.email ?? null,
        createdAt: row.created_at as string,
      };
    })
  );
  return assignments;
}

export async function assignAccountManager(clientId: string, userId: string): Promise<AgencyClientAssignment> {
  const { agency, userId: actorId } = await requireAgencyCapability("manage_agency");
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("agency_clients")
    .select("id")
    .eq("id", clientId)
    .eq("agency_id", agency.id)
    .maybeSingle();
  if (!client) throw new NotFoundError("Client not found.");
  const { data: member } = await supabase
    .from("agency_members")
    .select("user_id, role")
    .eq("agency_id", agency.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member || member.role !== "account_manager") {
    throw new ValidationError("Only agency Account Managers can be assigned to clients.");
  }
  const { data, error } = await supabase
    .from("agency_client_account_managers")
    .upsert(
      { agency_id: agency.id, client_id: clientId, user_id: userId, assigned_by: actorId },
      { onConflict: "client_id,user_id" }
    )
    .select("user_id, created_at")
    .single();
  if (error || !data) throw new Error("Could not assign the Account Manager.");
  const admin = createAdminClient();
  const { data: user } = await admin.auth.admin.getUserById(userId);
  return { userId: data.user_id as string, email: user.user?.email ?? null, createdAt: data.created_at as string };
}

export async function unassignAccountManager(clientId: string, userId: string): Promise<boolean> {
  const { agency } = await requireAgencyCapability("manage_agency");
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("agency_clients")
    .select("id")
    .eq("id", clientId)
    .eq("agency_id", agency.id)
    .maybeSingle();
  if (!client) throw new NotFoundError("Client not found.");
  const { error } = await supabase
    .from("agency_client_account_managers")
    .delete()
    .eq("agency_id", agency.id)
    .eq("client_id", clientId)
    .eq("user_id", userId);
  return !error;
}

/**
 * Lists the caller agency's team seats, resolving each member's email via the
 * admin client (auth.users is not readable through RLS). Owner first, then by
 * join order.
 */
export async function listMembers(): Promise<AgencyMember[]> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_members")
    .select(MEMBER_COLS)
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  const admin = createAdminClient();
  const emailById = new Map<string, string | null>();
  await Promise.all(
    data.map(async (row) => {
      const id = row.user_id as string;
      if (emailById.has(id)) return;
      const { data: u } = await admin.auth.admin.getUserById(id);
      emailById.set(id, u.user?.email ?? null);
    })
  );

  return data
    .map((row) => mapMember(row, emailById.get(row.user_id as string) ?? null))
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
}

/**
 * Adds a colleague to the agency by email, enforcing the tier's seat limit
 * (TIER_CONFIG.seats; Enterprise is unlimited). The invitee must already have a
 * Comply-Quick account. Idempotent: re-adding an existing member is a no-op.
 */
export async function addMember(email: string, requestedRole: AgencyRole = "client_viewer"): Promise<AgencyMember> {
  const { agency } = await requireAgencyCapability("manage_agency");
  const access = await getAgencyAccess();
  if (!access.assignableRoles.includes(requestedRole)) {
    throw new ForbiddenError("You cannot assign a role above your own.");
  }
  const entitlement = await getEntitlement();
  const supabase = await createClient();

  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new ValidationError("Enter a valid email address.");

  const seatLimit = TIER_CONFIG[entitlement.tier].seats;
  if (!isUnlimited(seatLimit)) {
    const { count } = await supabase
      .from("agency_members")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id);
    if ((count ?? 0) >= seatLimit) {
      throw new ValidationError(
        `Your ${TIER_CONFIG[entitlement.tier].label} plan includes ${seatLimit} seats. Upgrade to add more.`
      );
    }
  }

  // Resolve the email to an existing account (auth.users needs the admin client).
  const admin = createAdminClient();
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) {
    log.error("Failed to look up user by email", { error: listErr.message });
    throw new Error("Could not add member.");
  }
  const found = list.users.find((u) => u.email?.toLowerCase() === normalized);
  if (!found) throw new ValidationError("No Comply-Quick account found for that email. Ask them to sign up first.");

  // Idempotent: if the user is already a member, return their existing seat
  // unchanged. Role changes go through updateMemberRole so re-inviting never
  // silently overwrites (and possibly demotes) an existing member's role.
  const { data: existing } = await supabase
    .from("agency_members")
    .select(MEMBER_COLS)
    .eq("agency_id", agency.id)
    .eq("user_id", found.id)
    .maybeSingle();
  if (existing) return mapMember(existing, found.email ?? null);

  const { data, error } = await supabase
    .from("agency_members")
    .insert({ agency_id: agency.id, user_id: found.id, role: requestedRole })
    .select(MEMBER_COLS)
    .single();
  if (error || !data) {
    log.error("Failed to add member", { error: error?.message });
    throw new Error("Could not add member.");
  }
  log.info("Added agency member", { agencyId: agency.id, userId: found.id });
  return mapMember(data, found.email ?? null);
}

export async function updateMemberRole(userId: string, requestedRole: AgencyRole): Promise<AgencyMember> {
  const access = await requireAgencyCapability("manage_agency");
  if (userId === access.agency.ownerId) throw new ValidationError("The agency owner role cannot be changed.");
  if (!access.assignableRoles.includes(requestedRole)) {
    throw new ForbiddenError("You cannot assign a role above your own.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_members")
    .update({ role: requestedRole })
    .eq("agency_id", access.agency.id)
    .eq("user_id", userId)
    .neq("role", "owner")
    .select(MEMBER_COLS)
    .maybeSingle();
  if (error || !data) throw new NotFoundError("Agency member not found.");
  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(userId);
  return mapMember(data, found.user?.email ?? null);
}

/** Removes a team seat. The owner seat cannot be removed. */
export async function removeMember(userId: string): Promise<boolean> {
  const { agency } = await requireAgencyCapability("manage_agency");
  const supabase = await createClient();
  if (userId === agency.ownerId) throw new ValidationError("The agency owner seat cannot be removed.");
  const { error } = await supabase
    .from("agency_members")
    .delete()
    .eq("agency_id", agency.id)
    .eq("user_id", userId)
    .neq("role", "owner");
  if (error) return false;
  const { error: assignmentError } = await supabase
    .from("agency_client_account_managers")
    .delete()
    .eq("agency_id", agency.id)
    .eq("user_id", userId);
  return !assignmentError;
}

// ─── Custom domains ────────────────────────────────────────────────────────────

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

/** True when `domain` is a syntactically valid, already-normalized hostname. */
export function isValidDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain);
}

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

export async function listDomains(): Promise<AgencyDomain[]> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_domains")
    .select(DOMAIN_COLS)
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapDomain);
}

export async function addDomain(rawDomain: string): Promise<AgencyDomain> {
  const { agency } = await requireAgencyCapability("manage_agency");
  const supabase = await createClient();
  const domain = normalizeDomain(rawDomain);
  if (!isValidDomain(domain)) throw new ValidationError("Enter a valid domain, e.g. compliance.acme.com.");

  // Register with the active provider (Vercel/Cloudflare) so it issues TLS and
  // reports the DNS records the client must add. If provisioning fails or no
  // provider is configured, the domain is still saved as `pending`.
  const provider = getDomainProvider();
  const insert: Record<string, unknown> = { agency_id: agency.id, domain };
  if (provider) {
    try {
      const result = await provider.provision(domain);
      insert.provider = provider.id;
      insert.dns = result.verifications;
      insert.status = result.verified ? "verified" : "pending";
      if (result.verified) insert.verified_at = new Date().toISOString();
    } catch (err) {
      log.warn("Domain provisioning failed; saved as pending", {
        domain,
        provider: provider.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const { data, error } = await supabase.from("agency_domains").insert(insert).select(DOMAIN_COLS).single();
  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      throw new ValidationError("That domain is already registered.");
    }
    log.error("Failed to add domain", { error: error.message });
    throw new Error("Could not add domain.");
  }
  return mapDomain(data);
}

/** Re-checks a domain with the provider and flips it to `verified` once live. */
export async function verifyDomain(id: string): Promise<AgencyDomain> {
  const { agency } = await requireAgencyCapability("manage_agency");
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("agency_domains")
    .select(DOMAIN_COLS)
    .eq("id", id)
    .eq("agency_id", agency.id)
    .maybeSingle();
  if (!row) throw new NotFoundError("Domain not found.");
  const current = mapDomain(row);

  const provider = getDomainProvider();
  if (!provider) return current;

  let update: Record<string, unknown>;
  try {
    const result = await provider.check(current.domain);
    update = {
      provider: provider.id,
      dns: result.verifications,
      status: result.verified ? "verified" : "pending",
      verified_at: result.verified ? new Date().toISOString() : null,
    };
  } catch (err) {
    log.warn("Domain verification check failed", {
      domain: current.domain,
      error: err instanceof Error ? err.message : String(err),
    });
    update = { status: "error" };
  }

  const { data, error } = await supabase
    .from("agency_domains")
    .update(update)
    .eq("id", id)
    .eq("agency_id", agency.id)
    .select(DOMAIN_COLS)
    .single();
  if (error || !data) throw new Error("Could not update domain status.");
  return mapDomain(data);
}

export async function deleteDomain(id: string): Promise<boolean> {
  const { agency } = await requireAgencyCapability("manage_agency");
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("agency_domains")
    .select("domain")
    .eq("id", id)
    .eq("agency_id", agency.id)
    .maybeSingle();

  const { error } = await supabase.from("agency_domains").delete().eq("id", id).eq("agency_id", agency.id);
  if (error) return false;

  const provider = getDomainProvider();
  if (provider && row?.domain) await provider.remove(row.domain as string);
  return true;
}

/**
 * Public branding lookup by vanity slug (/portal/<slug>). Admin client since the
 * white-label surface is unauthenticated. Returns null when the slug is unknown.
 */
export async function getAgencyBySlug(slug: string): Promise<Agency | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("agencies").select(AGENCY_COLS).eq("slug", clean).maybeSingle();
  return data ? mapAgency(data) : null;
}

/**
 * Resolves the branding for a public request arriving on a custom domain. Uses
 * the admin client because there is no user session on the white-label surface.
 * Returns null for unknown/unverified domains so callers fall back to default
 * Comply-Quick branding.
 */
export async function resolveAgencyByDomain(rawHost: string): Promise<Agency | null> {
  const host = normalizeDomain(rawHost);
  if (!host) return null;
  const admin = createAdminClient();
  const { data: domainRow } = await admin
    .from("agency_domains")
    .select("agency_id, status")
    .eq("domain", host)
    .eq("status", "verified")
    .maybeSingle();
  if (!domainRow) return null;
  const { data } = await admin.from("agencies").select(AGENCY_COLS).eq("id", domainRow.agency_id).maybeSingle();
  return data ? mapAgency(data) : null;
}
