import { createClient } from "@/lib/supabase/server";

function configuredAdminEmails(): string[] {
  const value = process.env.PLATFORM_ADMIN_EMAILS || process.env.MARKETPLACE_ADMIN_EMAILS || "";
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns true when the signed-in user is on the platform-admin allowlist. */
export async function isPlatformAdmin(): Promise<boolean> {
  const allowlist = configuredAdminEmails();
  if (allowlist.length === 0) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && allowlist.includes(email));
}
