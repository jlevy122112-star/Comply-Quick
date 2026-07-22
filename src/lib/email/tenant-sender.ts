import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantSender {
  /** Tenant-verified sender address, or null when none is configured. */
  from: string | null;
  /** Optional reply-to address for that tenant. */
  replyTo: string | null;
}

/**
 * Resolves the preferred outbound email identity for a user, walking from their
 * personal organization to their oldest organization membership. The result is a
 * safe default for notification dispatch; callers still fall back to the global
 * NOTIFICATIONS_FROM_EMAIL when this returns null.
 */
export async function resolveTenantSender(userId: string): Promise<TenantSender> {
  const admin = createAdminClient();

  const { data: personal } = await admin
    .from("organizations")
    .select("smtp_from_email, smtp_reply_to_email")
    .eq("owner_id", userId)
    .eq("is_personal", true)
    .maybeSingle();

  if (personal?.smtp_from_email) {
    return {
      from: personal.smtp_from_email,
      replyTo: personal.smtp_reply_to_email ?? null,
    };
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("organizations ( smtp_from_email, smtp_reply_to_email )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const joined = membership?.organizations;
  const org = Array.isArray(joined) ? joined[0] : joined;
  if (org?.smtp_from_email) {
    return { from: org.smtp_from_email, replyTo: org.smtp_reply_to_email ?? null };
  }

  return { from: null, replyTo: null };
}
