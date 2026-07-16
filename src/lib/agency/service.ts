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
import { TIER_CONFIG, isUnlimited } from "@/lib/pricing";

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
const CLIENT_COLS = "id, agency_id, name, contact_email, website_url, notes, status, created_at";
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

function mapClient(row: Record<string, unknown>): AgencyClient {
  return {
    id: row.id as string,
    agencyId: row.agency_id as string,
    name: row.name as string,
    contactEmail: (row.contact_email as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    status: (row.status as AgencyClient["status"]) ?? "active",
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
  const agency = await getOrCreateAgency();
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
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_clients")
    .select(CLIENT_COLS)
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapClient);
}

/** Fetches one client owned by the caller's agency, or null if not found. */
export async function getClient(id: string): Promise<AgencyClient | null> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_clients")
    .select(CLIENT_COLS)
    .eq("id", id)
    .eq("agency_id", agency.id)
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
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const name = input.name.trim();
  if (name.length === 0 || name.length > 120) throw new ValidationError("Client name must be 1–120 characters.");

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
  return mapClient(data);
}

export async function updateClient(
  id: string,
  patch: Partial<ClientInput> & { status?: AgencyClient["status"] }
): Promise<AgencyClient> {
  const agency = await getOrCreateAgency();
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
  const agency = await getOrCreateAgency();
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
 * so a plain owner-scoped read suffices.
 */
export async function getClientStats(): Promise<Record<string, ClientStats>> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const stats: Record<string, ClientStats> = {};
  const ensure = (id: string) => (stats[id] ??= { monitors: 0, projects: 0, lowestScore: null });

  const { data: monitors } = await supabase
    .from("scan_monitors")
    .select("client_id, last_score")
    .eq("user_id", user.id)
    .not("client_id", "is", null);
  for (const row of monitors ?? []) {
    const cid = row.client_id as string;
    const s = ensure(cid);
    s.monitors += 1;
    const score = row.last_score as number | null;
    if (score !== null && (s.lowestScore === null || score < s.lowestScore)) s.lowestScore = score;
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("client_id")
    .eq("user_id", user.id)
    .not("client_id", "is", null);
  for (const row of projects ?? []) ensure(row.client_id as string).projects += 1;

  // Only surface stats for clients that belong to this agency.
  const { data: clientIds } = await supabase.from("agency_clients").select("id").eq("agency_id", agency.id);
  const valid = new Set((clientIds ?? []).map((c) => c.id as string));
  for (const id of Object.keys(stats)) if (!valid.has(id)) delete stats[id];

  return stats;
}

// ─── Team seats (members) ──────────────────────────────────────────────────────

export interface AgencyMember {
  id: string;
  agencyId: string;
  userId: string;
  email: string | null;
  role: "owner" | "admin" | "member";
  createdAt: string;
}

const MEMBER_COLS = "id, agency_id, user_id, role, created_at";

function mapMember(row: Record<string, unknown>, email: string | null): AgencyMember {
  return {
    id: row.id as string,
    agencyId: row.agency_id as string,
    userId: row.user_id as string,
    email,
    role: (row.role as AgencyMember["role"]) ?? "member",
    createdAt: row.created_at as string,
  };
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
export async function addMember(email: string): Promise<AgencyMember> {
  const agency = await getOrCreateAgency();
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

  const { data, error } = await supabase
    .from("agency_members")
    .upsert({ agency_id: agency.id, user_id: found.id, role: "member" }, { onConflict: "agency_id,user_id" })
    .select(MEMBER_COLS)
    .single();
  if (error || !data) {
    log.error("Failed to add member", { error: error?.message });
    throw new Error("Could not add member.");
  }
  log.info("Added agency member", { agencyId: agency.id, userId: found.id });
  return mapMember(data, found.email ?? null);
}

/** Removes a team seat. The owner seat cannot be removed. */
export async function removeMember(userId: string): Promise<boolean> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  if (userId === agency.ownerId) throw new ValidationError("The agency owner seat cannot be removed.");
  const { error } = await supabase
    .from("agency_members")
    .delete()
    .eq("agency_id", agency.id)
    .eq("user_id", userId)
    .neq("role", "owner");
  return !error;
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
  const agency = await getOrCreateAgency();
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
  const agency = await getOrCreateAgency();
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
  const agency = await getOrCreateAgency();
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
