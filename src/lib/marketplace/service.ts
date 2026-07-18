// Template Marketplace server service (Phase 6).
//
// Lets premium users publish reusable compliance templates and any authenticated
// user buy them. Selling requires a Stripe Connect account (see stripe-connect.ts);
// payouts run as destination charges with a platform application fee. All
// reads/writes go through the RLS-scoped server client; purchase rows are written
// by the Stripe webhook (service-role) since there is no session in that context.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgEntitlement } from "@/lib/entitlements";
import { logger } from "@/services";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/services/errors";
import {
  isValidCategory,
  isValidType,
  isValidPrice,
  slugifyTitle,
  normalizeSearch,
  type TemplateCategory,
  type TemplateType,
  type TemplateContent,
  type Creator,
  type Template,
  type TemplateListing,
  type Purchase,
  type TemplateInput,
  type CreatorEarnings,
  type MarketplaceRevenue,
} from "./shared";

// Re-export the server-free types/helpers so existing importers of this module
// (routes, tests) keep their import path.
export * from "./shared";

const log = logger.child({ module: "marketplace" });

const CREATOR_COLS = "id, user_id, display_name, slug, bio, stripe_account_id, payouts_enabled, created_at";
const TEMPLATE_COLS =
  "id, creator_id, title, slug, summary, description, category, type, price_cents, currency, content, preview, body, status, sales_count, created_at, updated_at";
// Public listing columns omit `body` (the paid deliverable) so it is never
// exposed to non-purchasers browsing the marketplace.
const LISTING_COLS =
  "id, creator_id, title, slug, summary, description, category, type, price_cents, currency, content, preview, status, sales_count, created_at, updated_at";
const PURCHASE_COLS = "id, template_id, buyer_id, amount_cents, platform_fee_cents, currency, status, created_at";

function mapCreator(row: Record<string, unknown>): Creator {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string,
    slug: row.slug as string,
    bio: (row.bio as string) ?? "",
    stripeAccountId: (row.stripe_account_id as string | null) ?? null,
    payoutsEnabled: Boolean(row.payouts_enabled),
    createdAt: row.created_at as string,
  };
}

function mapTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    title: row.title as string,
    slug: row.slug as string,
    summary: (row.summary as string) ?? "",
    description: (row.description as string) ?? "",
    category: (row.category as TemplateCategory) ?? "general",
    type: (row.type as TemplateType) ?? "custom",
    priceCents: (row.price_cents as number) ?? 0,
    currency: (row.currency as string) ?? "usd",
    content: (row.content as TemplateContent | null) ?? {},
    preview: (row.preview as string) ?? "",
    body: (row.body as string) ?? "",
    status: (row.status as Template["status"]) ?? "draft",
    salesCount: (row.sales_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

function mapPurchase(row: Record<string, unknown>): Purchase {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    buyerId: row.buyer_id as string,
    amountCents: (row.amount_cents as number) ?? 0,
    platformFeeCents: (row.platform_fee_cents as number) ?? 0,
    currency: (row.currency as string) ?? "usd",
    status: (row.status as Purchase["status"]) ?? "pending",
    createdAt: row.created_at as string,
  };
}

// ─── Creator profile ─────────────────────────────────────────────────────────

/** Selling is gated to paid tiers; browsing/buying is open to any signed-in user. */
export async function canSell(): Promise<boolean> {
  const entitlement = await getOrgEntitlement();
  return entitlement.isPremium;
}

/** The caller's creator profile, or null if they haven't onboarded as a seller. */
export const getMyCreator = cache(async (): Promise<Creator | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  const { data } = await supabase
    .from("marketplace_creators")
    .select(CREATOR_COLS)
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? mapCreator(data) : null;
});

/**
 * Returns the caller's creator profile, creating it on first access. Paid tiers
 * only. The slug is derived from the display name and retried on collision with
 * another seller.
 */
export async function getOrCreateCreator(displayName?: string): Promise<Creator> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  if (!(await canSell())) {
    throw new ForbiddenError("Selling templates is available on paid plans.");
  }

  const existing = await supabase
    .from("marketplace_creators")
    .select(CREATOR_COLS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.data) return mapCreator(existing.data);

  const name = (displayName ?? user.email?.split("@")[0] ?? "Creator").trim().slice(0, 80) || "Creator";
  const seed = slugifyTitle(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("marketplace_creators")
      .insert({ user_id: user.id, display_name: name, slug: candidate })
      .select(CREATOR_COLS)
      .single();
    if (!error && data) {
      log.info("Created creator profile", { creatorId: data.id, slug: candidate });
      return mapCreator(data);
    }
    if (!error?.message.toLowerCase().includes("duplicate")) {
      log.error("Failed to create creator", { error: error?.message });
      throw new Error("Could not create creator profile.");
    }
    // A duplicate on user_id means a concurrent create won; re-read and use it.
    const mine = await supabase.from("marketplace_creators").select(CREATOR_COLS).eq("user_id", user.id).maybeSingle();
    if (mine.data) return mapCreator(mine.data);
  }
  throw new Error(`Could not allocate a unique creator slug (seed: ${seed}).`);
}

/** Updates the caller's creator profile (display name / bio). */
export async function updateCreatorProfile(patch: { displayName?: string; bio?: string }): Promise<Creator> {
  const creator = await getOrCreateCreator();
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim().slice(0, 80);
    if (!name) throw new ValidationError("Display name cannot be empty.");
    update.display_name = name;
  }
  if (patch.bio !== undefined) update.bio = patch.bio.slice(0, 2000);

  const { data, error } = await supabase
    .from("marketplace_creators")
    .update(update)
    .eq("id", creator.id)
    .select(CREATOR_COLS)
    .single();
  if (error || !data) throw new Error("Could not update creator profile.");
  return mapCreator(data);
}

// ─── Templates (creator-side) ────────────────────────────────────────────────

/** Creates a draft template owned by the caller's creator profile. */
export async function createTemplate(input: TemplateInput): Promise<Template> {
  const creator = await getOrCreateCreator();
  const supabase = await createClient();

  const title = input.title?.trim();
  if (!title) throw new ValidationError("A title is required.");
  const category = input.category ?? "general";
  if (!isValidCategory(category)) throw new ValidationError("Invalid category.");
  const type = input.type ?? "custom";
  if (!isValidType(type)) throw new ValidationError("Invalid template type.");
  const priceCents = input.priceCents ?? 0;
  if (!isValidPrice(priceCents))
    throw new ValidationError("Price must be a whole number of cents between 0 and 1,000,000.");

  const seed = slugifyTitle(title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("marketplace_templates")
      .insert({
        creator_id: creator.id,
        title: title.slice(0, 120),
        slug: candidate,
        summary: (input.summary ?? "").slice(0, 200),
        description: (input.description ?? "").slice(0, 5000),
        category,
        type,
        price_cents: priceCents,
        content: input.content ?? {},
        preview: (input.preview ?? "").slice(0, 2000),
        body: (input.body ?? "").slice(0, 50_000),
      })
      .select(TEMPLATE_COLS)
      .single();
    if (!error && data) return mapTemplate(data);
    if (!error?.message.toLowerCase().includes("duplicate")) {
      log.error("Failed to create template", { error: error?.message });
      throw new Error("Could not create template.");
    }
  }
  throw new Error(`Could not allocate a unique template slug (seed: ${seed}).`);
}

/**
 * Get-or-create a creator profile for an explicit user id using the service-role
 * client. Used by the metered API, where the request is authenticated by an API
 * key and has no Supabase session. Entitlement is checked by the caller.
 */
async function getOrCreateCreatorForUser(userId: string): Promise<Creator> {
  const admin = createAdminClient();
  const existing = await admin.from("marketplace_creators").select(CREATOR_COLS).eq("user_id", userId).maybeSingle();
  if (existing.data) return mapCreator(existing.data);

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const name = (userData.user?.email?.split("@")[0] ?? "Creator").trim().slice(0, 80) || "Creator";
  const seed = slugifyTitle(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await admin
      .from("marketplace_creators")
      .insert({ user_id: userId, display_name: name, slug: candidate })
      .select(CREATOR_COLS)
      .single();
    if (!error && data) return mapCreator(data);
    if (!error?.message.toLowerCase().includes("duplicate")) throw new Error("Could not create creator profile.");
    const mine = await admin.from("marketplace_creators").select(CREATOR_COLS).eq("user_id", userId).maybeSingle();
    if (mine.data) return mapCreator(mine.data);
  }
  throw new Error(`Could not allocate a unique creator slug (seed: ${seed}).`);
}

/**
 * Creates a draft template on behalf of an explicit user via the service-role
 * client (metered API / programmatic upload). Mirrors createTemplate's
 * validation but does not rely on a session. The $50 upload charge is metered by
 * the calling route.
 */
export async function createTemplateForUser(userId: string, input: TemplateInput): Promise<Template> {
  const creator = await getOrCreateCreatorForUser(userId);
  const admin = createAdminClient();

  const title = input.title?.trim();
  if (!title) throw new ValidationError("A title is required.");
  const category = input.category ?? "general";
  if (!isValidCategory(category)) throw new ValidationError("Invalid category.");
  const type = input.type ?? "custom";
  if (!isValidType(type)) throw new ValidationError("Invalid template type.");
  const priceCents = input.priceCents ?? 0;
  if (!isValidPrice(priceCents))
    throw new ValidationError("Price must be a whole number of cents between 0 and 1,000,000.");

  const seed = slugifyTitle(title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await admin
      .from("marketplace_templates")
      .insert({
        creator_id: creator.id,
        title: title.slice(0, 120),
        slug: candidate,
        summary: (input.summary ?? "").slice(0, 200),
        description: (input.description ?? "").slice(0, 5000),
        category,
        type,
        price_cents: priceCents,
        content: input.content ?? {},
        preview: (input.preview ?? "").slice(0, 2000),
        body: (input.body ?? "").slice(0, 50_000),
      })
      .select(TEMPLATE_COLS)
      .single();
    if (!error && data) return mapTemplate(data);
    if (!error?.message.toLowerCase().includes("duplicate")) throw new Error("Could not create template.");
  }
  throw new Error(`Could not allocate a unique template slug (seed: ${seed}).`);
}

/** Updates fields of a template the caller owns. */
export async function updateTemplate(id: string, patch: Partial<TemplateInput>): Promise<Template> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new ValidationError("A title is required.");
    update.title = title.slice(0, 120);
  }
  if (patch.summary !== undefined) update.summary = patch.summary.slice(0, 200);
  if (patch.description !== undefined) update.description = patch.description.slice(0, 5000);
  if (patch.category !== undefined) {
    if (!isValidCategory(patch.category)) throw new ValidationError("Invalid category.");
    update.category = patch.category;
  }
  if (patch.type !== undefined) {
    if (!isValidType(patch.type)) throw new ValidationError("Invalid template type.");
    update.type = patch.type;
  }
  if (patch.priceCents !== undefined) {
    if (!isValidPrice(patch.priceCents)) throw new ValidationError("Invalid price.");
    update.price_cents = patch.priceCents;
  }
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.preview !== undefined) update.preview = patch.preview.slice(0, 2000);
  if (patch.body !== undefined) update.body = patch.body.slice(0, 50_000);

  const { data, error } = await supabase
    .from("marketplace_templates")
    .update(update)
    .eq("id", id)
    .select(TEMPLATE_COLS)
    .maybeSingle();
  if (error) throw new Error("Could not update template.");
  if (!data) throw new NotFoundError("Template not found.");
  return mapTemplate(data);
}

/** Publishes or unpublishes a template the caller owns. */
export async function setTemplateStatus(id: string, status: Template["status"]): Promise<Template> {
  if (!["draft", "published", "unlisted"].includes(status)) throw new ValidationError("Invalid status.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketplace_templates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(TEMPLATE_COLS)
    .maybeSingle();
  if (error) throw new Error("Could not update template status.");
  if (!data) throw new NotFoundError("Template not found.");
  return mapTemplate(data);
}

/** Deletes a template the caller owns. */
export async function deleteTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("marketplace_templates").delete().eq("id", id);
  if (error) throw new Error("Could not delete template.");
}

/** Lists all of the caller's own templates (any status). */
export async function listMyTemplates(): Promise<Template[]> {
  const creator = await getMyCreator();
  if (!creator) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketplace_templates")
    .select(TEMPLATE_COLS)
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapTemplate);
}

// ─── Templates (buyer-side) ──────────────────────────────────────────────────

/** Lists published templates, optionally filtered by search text and category. */
export async function listPublishedTemplates(
  opts: { search?: string; category?: string; type?: string } = {}
): Promise<TemplateListing[]> {
  const supabase = await createClient();
  let query = supabase
    .from("marketplace_templates")
    .select(`${LISTING_COLS}, marketplace_creators!inner(display_name)`)
    .eq("status", "published");

  if (opts.category && isValidCategory(opts.category)) query = query.eq("category", opts.category);
  if (opts.type && isValidType(opts.type)) query = query.eq("type", opts.type);
  const search = normalizeSearch(opts.search ?? "");
  if (search) query = query.ilike("title", `%${search}%`);

  const { data } = await query.order("sales_count", { ascending: false }).limit(60);
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const creator = rec.marketplace_creators as { display_name?: string } | null;
    return { ...mapTemplate(rec), creatorName: creator?.display_name ?? "Unknown" };
  });
}

/**
 * A single published (or caller-owned) template by slug. The full `body`
 * (paid deliverable) is only included when the caller is the creator or has
 * purchased it; other viewers get an empty body and only see the preview.
 */
export async function getTemplateBySlug(slug: string): Promise<TemplateListing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketplace_templates")
    .select(`${TEMPLATE_COLS}, marketplace_creators!inner(display_name)`)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const rec = data as Record<string, unknown>;
  const creator = rec.marketplace_creators as { display_name?: string } | null;
  const listing: TemplateListing = { ...mapTemplate(rec), creatorName: creator?.display_name ?? "Unknown" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let entitled = false;
  if (user) {
    const [{ data: ownRow }, { data: purchaseRow }] = await Promise.all([
      supabase.from("marketplace_creators").select("id").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("marketplace_purchases")
        .select("id")
        .eq("template_id", listing.id)
        .eq("buyer_id", user.id)
        .eq("status", "paid")
        .maybeSingle(),
    ]);
    const isOwner = Boolean(ownRow && (ownRow as { id: string }).id === listing.creatorId);
    entitled = isOwner || Boolean(purchaseRow);
  }
  if (!entitled) listing.body = "";
  return listing;
}

/** Template ids the caller has already purchased (status paid). */
export async function getPurchasedTemplateIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("marketplace_purchases")
    .select("template_id")
    .eq("buyer_id", user.id)
    .eq("status", "paid");
  return new Set((data ?? []).map((r) => (r as { template_id: string }).template_id));
}

/** The caller's purchases (paid or pending). */
export async function listMyPurchases(): Promise<Purchase[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  const { data } = await supabase
    .from("marketplace_purchases")
    .select(PURCHASE_COLS)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapPurchase);
}

// ─── Earnings + revenue reporting ────────────────────────────────────────────

/**
 * The caller's creator earnings across all paid sales of their listings. RLS lets
 * a creator read purchases of their own templates, so this aggregates the rows
 * that policy already exposes — gross, platform fee retained, and net take-home.
 */
export async function getCreatorEarnings(): Promise<CreatorEarnings> {
  const creator = await getMyCreator();
  if (!creator) return { grossCents: 0, platformFeeCents: 0, netCents: 0, sales: 0 };
  const supabase = await createClient();
  // Purchases of the caller's templates (creator-visible via RLS), paid only.
  const { data } = await supabase
    .from("marketplace_purchases")
    .select("amount_cents, platform_fee_cents, marketplace_templates!inner(creator_id)")
    .eq("status", "paid")
    .eq("marketplace_templates.creator_id", creator.id);

  return (data ?? []).reduce<CreatorEarnings>(
    (acc, row) => {
      const rec = row as { amount_cents?: number; platform_fee_cents?: number };
      const gross = rec.amount_cents ?? 0;
      const fee = rec.platform_fee_cents ?? 0;
      return {
        grossCents: acc.grossCents + gross,
        platformFeeCents: acc.platformFeeCents + fee,
        netCents: acc.netCents + (gross - fee),
        sales: acc.sales + 1,
      };
    },
    { grossCents: 0, platformFeeCents: 0, netCents: 0, sales: 0 }
  );
}

/** True when the caller's email is on the platform-admin allowlist (env-configured). */
export async function isPlatformAdmin(): Promise<boolean> {
  const allowlist = (process.env.MARKETPLACE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && allowlist.includes(email));
}

/**
 * Platform-wide marketplace revenue: gross sales, the platform's retained fees,
 * and total creator payouts. Uses the service-role client (aggregates across all
 * creators, past RLS) and is gated to platform admins by the caller/route.
 */
export async function getMarketplaceRevenue(): Promise<MarketplaceRevenue> {
  if (!(await isPlatformAdmin())) throw new ForbiddenError("Marketplace revenue is restricted to platform admins.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("marketplace_revenue_totals").maybeSingle();
  if (error) throw new Error("Could not load marketplace revenue.");
  const rec = (data ?? {}) as {
    gross_cents?: number;
    platform_fee_cents?: number;
    creator_net_cents?: number;
    sales?: number;
  };
  return {
    grossCents: Number(rec.gross_cents ?? 0),
    platformRevenueCents: Number(rec.platform_fee_cents ?? 0),
    creatorPayoutCents: Number(rec.creator_net_cents ?? 0),
    sales: Number(rec.sales ?? 0),
  };
}
