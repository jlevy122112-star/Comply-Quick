import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/services";
import { getActiveOrganizationId, getMyOrgRole } from "@/lib/organizations-db";
import { can } from "@/lib/rbac";

/**
 * Creates a Stripe Customer Portal session so subscribers can manage or cancel
 * their plan and update payment methods.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ error: "Organization context is required" }, { status: 400 });
  }
  const role = await getMyOrgRole(organizationId);
  if (!role || !can(role, "org:billing")) {
    return NextResponse.json(
      { error: "You do not have permission to manage billing for this organization." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const [{ data: orgSub }, { data: ownerSub }] = await Promise.all([
    admin
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    admin.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const customerId = orgSub?.stripe_customer_id ?? ownerSub?.stripe_customer_id ?? null;

  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found for this workspace. Choose a paid plan to create one." },
      { status: 404 }
    );
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/settings/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Portal session failed", message }, { status: 500 });
  }
}
