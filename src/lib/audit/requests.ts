import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Extracts the caller IP from request headers.
 * Accepts an optional header source so it can be used from Next.js API routes
 * (`NextRequest.headers`) and from server actions (`next/headers`).
 */
export async function getRequestIp(source?: { get(name: string): string | null }): Promise<string | undefined> {
  try {
    const h = source ?? (await headers());
    const forwarded = h.get("x-forwarded-for");
    const ip = h.get("x-real-ip") ?? (forwarded ? forwarded.split(",")[0].trim() : undefined);
    return ip || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the currently authenticated user as an audit actor.
 * Returns `null` when there is no active session.
 */
export async function getCurrentActor(): Promise<{ actorId: string; actorType: "USER" } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { actorId: user.id, actorType: "USER" };
}
