// Agency Client Portal server service (Phase 5).
//
// Multi-tenant glue on top of the per-user app. An Agency/Enterprise user owns
// exactly one `agency` workspace (created on demand), under which they manage
// client profiles, white-label branding, and custom domains. All reads/writes
// go through the RLS-scoped server client; the tenant resolver (public landing
// on a custom domain) uses the admin client since there is no session yet.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/entitlements";
import { logger } from "@/services";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/services/errors";

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
  verifiedAt: string | null;
  createdAt: string;
}

const AGENCY_COLS = "id, owner_id, name, slug, logo_url, primary_color, support_email, created_at";
const CLIENT_COLS = "id, agency_id, name, contact_email, website_url, notes, status, created_at";
const DOMAIN_COLS = "id, agency_id, domain, status, verification_token, verified_at, created_at";

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
 * Returns the caller's agency workspace, creating it on first access. Pro-gated
 * (agency/enterprise). The owner is also inserted as an `owner` member row so
 * membership checks are uniform.
 */
export async function getOrCreateAgency(): Promise<Agency> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  if (!(await canUseAgencyPortal())) {
    throw new ForbiddenError("The client portal is available on the Agency and Enterprise plans.");
  }

  const existing = await supabase.from("agencies").select(AGENCY_COLS).eq("owner_id", user.id).maybeSingle();
  if (existing.data) return mapAgency(existing.data);

  // Derive a unique slug (retry with a numeric suffix on collision).
  const seed = slugify(user.email?.split("@")[0] ?? "agency");
  let slug = seed;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("agencies")
      .insert({ owner_id: user.id, name: "My Agency", slug: candidate })
      .select(AGENCY_COLS)
      .single();
    if (!error && data) {
      slug = candidate;
      await supabase.from("agency_members").insert({ agency_id: data.id, user_id: user.id, role: "owner" });
      log.info("Created agency workspace", { agencyId: data.id, slug });
      return mapAgency(data);
    }
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      log.error("Failed to create agency", { error: error.message });
      throw new Error("Could not create agency workspace.");
    }
  }
  throw new Error(`Could not allocate a unique agency slug (seed: ${slug}).`);
}

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

  const { data, error } = await supabase
    .from("agency_domains")
    .insert({ agency_id: agency.id, domain })
    .select(DOMAIN_COLS)
    .single();
  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      throw new ValidationError("That domain is already registered.");
    }
    log.error("Failed to add domain", { error: error.message });
    throw new Error("Could not add domain.");
  }
  return mapDomain(data);
}

export async function deleteDomain(id: string): Promise<boolean> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { error } = await supabase.from("agency_domains").delete().eq("id", id).eq("agency_id", agency.id);
  return !error;
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
