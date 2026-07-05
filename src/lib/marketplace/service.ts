// Template Marketplace server service (Phase 6).
//
// Lets premium users publish reusable compliance templates and any authenticated
// user buy them. Selling requires a Stripe Connect account (see stripe-connect.ts);
// payouts run as destination charges with a platform application fee. All
// reads/writes go through the RLS-scoped server client; purchase rows are written
// by the Stripe webhook (service-role) since there is no session in that context.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { logger } from "@/services";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/services/errors";
import {
  isValidCategory,
  isValidPrice,
  slugifyTitle,
  normalizeSearch,
  type TemplateCategory,
  type TemplateContent,
  type Creator,
  type Template,
  type TemplateListing,
  type Purchase,
  type TemplateInput,
} from "./shared";

// Re-export the server-free types/helpers so existing importers of this module
// (routes, tests) keep their import path.
export * from "./shared";

const log = logger.child({ module: "marketplace" });

const CREATOR_COLS = "id, user_id, display_name, slug, bio, stripe_account_id, payouts_enabled, created_at";
const TEMPLATE_COLS =
  "id, creator_id, title, slug, summary, description, category, price_cents, currency, content, preview, status, sales_count, created_at, updated_at";
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
    priceCents: (row.price_cents as number) ?? 0,
    currency: (row.currency as string) ?? "usd",
    content: (row.content as TemplateContent | null) ?? {},
    preview: (row.preview as string) ?? "",
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
  const entitlement = await getEntitlement();
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
        price_cents: priceCents,
        content: input.content ?? {},
        preview: (input.preview ?? "").slice(0, 2000),
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
  if (patch.priceCents !== undefined) {
    if (!isValidPrice(patch.priceCents)) throw new ValidationError("Invalid price.");
    update.price_cents = patch.priceCents;
  }
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.preview !== undefined) update.preview = patch.preview.slice(0, 2000);

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
  opts: { search?: string; category?: string } = {}
): Promise<TemplateListing[]> {
  const supabase = await createClient();
  let query = supabase
    .from("marketplace_templates")
    .select(`${TEMPLATE_COLS}, marketplace_creators!inner(display_name)`)
    .eq("status", "published");

  if (opts.category && isValidCategory(opts.category)) query = query.eq("category", opts.category);
  const search = normalizeSearch(opts.search ?? "");
  if (search) query = query.ilike("title", `%${search}%`);

  const { data } = await query.order("sales_count", { ascending: false }).limit(60);
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const creator = rec.marketplace_creators as { display_name?: string } | null;
    return { ...mapTemplate(rec), creatorName: creator?.display_name ?? "Unknown" };
  });
}

/** A single published (or caller-owned) template by slug. */
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
  return { ...mapTemplate(rec), creatorName: creator?.display_name ?? "Unknown" };
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
