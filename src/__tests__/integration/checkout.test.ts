import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Integration test: Stripe checkout.session.completed → subscription entitlement.
// Exercises the real webhook route end-to-end (signature gate, event dispatch,
// tier mapping, DB upsert payload) with Stripe + Supabase mocked at the edges.

// Captures the row the handler upserts into `subscriptions`.
const upsertSpy = vi.fn();
const constructEvent = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      update: () => ({ eq: async () => ({ data: null }) }),
      upsert: async (row: unknown, opts: unknown) => {
        upsertSpy(table, row, opts);
        return { data: null, error: null };
      },
    }),
    rpc: async () => ({ data: null, error: null }),
  }),
}));

vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  return {
    ...actual,
    getStripe: () => ({ webhooks: { constructEvent } }),
    logger: { child: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
    analytics: { track: vi.fn() },
    sendRevenueAlert: vi.fn(async () => ({ ok: true })),
  };
});

vi.mock("@/lib/partners/service", () => ({
  recordReferralCommission: vi.fn(async () => undefined),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body: "{}",
  });
}

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/webhooks/stripe/route");
}

describe("Stripe webhook: checkout.session.completed", () => {
  beforeEach(() => {
    upsertSpy.mockReset();
    constructEvent.mockReset();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("creates an active subscription with the purchased tier", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          customer: "cus_123",
          subscription: "sub_123",
          metadata: { plan: "agency", supabase_user_id: "user_1" },
        },
      },
    });
    const { POST } = await loadRoute();

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const [table, row, opts] = upsertSpy.mock.calls[0];
    expect(table).toBe("subscriptions");
    expect(row).toMatchObject({
      user_id: "user_1",
      tier: "agency",
      status: "active",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
    });
    expect(opts).toEqual({ onConflict: "user_id" });
  });

  it("maps the retired 'single' plan key to 'solo'", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_2",
          customer: "cus_456",
          subscription: "sub_456",
          metadata: { plan: "single", supabase_user_id: "user_2" },
        },
      },
    });
    const { POST } = await loadRoute();

    await POST(makeRequest());

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][1]).toMatchObject({ tier: "solo", status: "active" });
  });

  it("does not create a subscription for a marketplace checkout", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_3",
          customer: "cus_789",
          metadata: { kind: "marketplace", marketplace_template_id: "tpl_1", supabase_user_id: "user_3" },
        },
      },
    });
    const { POST } = await loadRoute();

    await POST(makeRequest());

    // Marketplace path updates a purchase row, never upserts a subscription.
    const subscriptionUpserts = upsertSpy.mock.calls.filter((c) => c[0] === "subscriptions");
    expect(subscriptionUpserts).toHaveLength(0);
  });

  it("rejects an unverified signature with 400", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const { POST } = await loadRoute();

    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
