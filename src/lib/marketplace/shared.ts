// Server-free marketplace types + pure helpers.
//
// Kept separate from service.ts (which imports the server-only Supabase client)
// so client components can import these constants/types/helpers without pulling
// server code into the browser bundle.

/** Platform commission retained on each paid sale, in basis points (15%). */
export const PLATFORM_FEE_BPS = 1500;

/** Categories a template may be listed under (kept in sync with the DB check). */
export const TEMPLATE_CATEGORIES = ["general", "ecommerce", "saas", "healthcare", "finance", "agency"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** The reusable wizard preset a template applies when a buyer uses it. */
export interface TemplateContent {
  userType?: string;
  framework?: string;
  trackingPixels?: string[];
  targetRegions?: string[];
  complianceModules?: string[];
}

export interface Creator {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  bio: string;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  createdAt: string;
}

export interface Template {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: TemplateCategory;
  priceCents: number;
  currency: string;
  content: TemplateContent;
  preview: string;
  status: "draft" | "published" | "unlisted";
  salesCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A published template joined with its seller's public display name. */
export interface TemplateListing extends Template {
  creatorName: string;
}

export interface Purchase {
  id: string;
  templateId: string;
  buyerId: string;
  amountCents: number;
  platformFeeCents: number;
  currency: string;
  status: "pending" | "paid" | "refunded";
  createdAt: string;
}

export interface TemplateInput {
  title: string;
  summary?: string;
  description?: string;
  category?: string;
  priceCents?: number;
  content?: TemplateContent;
  preview?: string;
}

// ─── Pure helpers (unit-tested; no DB) ──────────────────────────────────────

/** Platform application fee for a sale, in whole cents (rounded to nearest). */
export function platformFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return Math.round((amountCents * PLATFORM_FEE_BPS) / 10_000);
}

/** True for a whole-cent price within the allowed 0–$10,000 range. */
export function isValidPrice(cents: number): boolean {
  return Number.isInteger(cents) && cents >= 0 && cents <= 1_000_000;
}

/** True when `value` is one of the allowed template categories. */
export function isValidCategory(value: string): value is TemplateCategory {
  return (TEMPLATE_CATEGORIES as readonly string[]).includes(value);
}

/** Turns a listing title into a URL-safe slug seed (empty → "template"). */
export function slugifyTitle(input: string): string {
  // The first replace collapses every run of non-alphanumerics to a single "-",
  // so at most one leading/trailing dash can exist — trimming a single dash (no
  // "+") avoids the polynomial backtracking CodeQL flags on user input.
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "template";
}

/** Normalizes a free-text search query for a case-insensitive prefix match. */
export function normalizeSearch(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 100);
}
