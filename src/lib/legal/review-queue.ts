// DB-backed service for the legal review queue ([Up10]).
//
// The table (legal_review_items) is org-wide internal tooling with RLS enabled
// and no permissive policies, so every access uses the service-role client and
// is gated in code by an admin-email allowlist (LEGAL_REVIEW_ADMIN_EMAILS).

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/services";
import { UnauthorizedError, ForbiddenError, ValidationError, NotFoundError } from "@/services/errors";
import {
  isLegalAdmin,
  isReviewStatus,
  isReviewCategory,
  nextQuarterlyReviewDate,
  type LegalReviewItem,
  type ReviewCategory,
  type ReviewStatus,
} from "./review";

const log = logger.child({ module: "legal-review" });

const COLS = "id, title, category, content_ref, status, reviewer, notes, reviewed_at, next_review_at, created_at";

function mapItem(row: Record<string, unknown>): LegalReviewItem {
  return {
    id: row.id as string,
    title: row.title as string,
    category: (row.category as ReviewCategory) ?? "clause_template",
    contentRef: (row.content_ref as string) ?? "",
    status: (row.status as ReviewStatus) ?? "pending",
    reviewer: (row.reviewer as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    nextReviewAt: String(row.next_review_at).slice(0, 10),
    createdAt: row.created_at as string,
  };
}

/**
 * Ensures the caller is signed in AND on the legal-review admin allowlist.
 * Returns the caller's email. Throws Unauthorized (not signed in) or Forbidden
 * (signed in but not an allowed reviewer).
 */
export async function requireLegalAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError("Sign in to access the legal review queue.");
  const email = user.email ?? null;
  if (!isLegalAdmin(email, process.env.LEGAL_REVIEW_ADMIN_EMAILS)) {
    throw new ForbiddenError("You are not authorized to access the legal review queue.");
  }
  return email as string;
}

/** Lists all review items, soonest-due first. Admin-gated. */
export async function listReviewItems(): Promise<LegalReviewItem[]> {
  await requireLegalAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("legal_review_items")
    .select(COLS)
    .order("next_review_at", { ascending: true });
  if (error) {
    log.error("failed to list legal review items", { err: error.message });
    throw new Error("Could not load the legal review queue.");
  }
  return (data ?? []).map(mapItem);
}

export interface EnqueueReviewInput {
  title: string;
  category: ReviewCategory;
  contentRef?: string;
}

/** Adds an artifact to the review queue with a quarterly due date. Admin-gated. */
export async function enqueueReviewItem(input: EnqueueReviewInput): Promise<LegalReviewItem> {
  await requireLegalAdmin();

  const title = input.title?.trim();
  if (!title) throw new ValidationError("A title is required.");
  if (title.length > 200) throw new ValidationError("Title must be 200 characters or fewer.");
  if (!isReviewCategory(input.category)) throw new ValidationError("Invalid review category.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("legal_review_items")
    .insert({
      title,
      category: input.category,
      content_ref: input.contentRef?.trim() ?? "",
      next_review_at: nextQuarterlyReviewDate(),
    })
    .select(COLS)
    .single();
  if (error || !data) {
    log.error("failed to enqueue legal review item", { err: error?.message });
    throw new Error("Could not add the review item.");
  }
  return mapItem(data);
}

export interface RecordReviewInput {
  status: ReviewStatus;
  notes?: string;
}

/**
 * Records a review decision: sets status/notes/reviewer, stamps reviewed_at,
 * and reschedules the next quarterly review. Admin-gated.
 */
export async function recordReview(id: string, input: RecordReviewInput): Promise<LegalReviewItem> {
  const reviewer = await requireLegalAdmin();

  if (!id) throw new ValidationError("A review item id is required.");
  if (!isReviewStatus(input.status)) throw new ValidationError("Invalid review status.");

  const now = new Date();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("legal_review_items")
    .update({
      status: input.status,
      reviewer,
      notes: input.notes?.trim() ?? "",
      reviewed_at: now.toISOString(),
      next_review_at: nextQuarterlyReviewDate(now),
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .select(COLS)
    .maybeSingle();
  if (error) {
    log.error("failed to record legal review", { err: error.message });
    throw new Error("Could not record the review.");
  }
  if (!data) throw new NotFoundError("Review item not found.");
  return mapItem(data);
}
