import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────
// The checkout route depends on the Supabase server/admin clients. We mock them
// so the route can be exercised in isolation without a request scope or network.

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null }) }),
      }),
      upsert: async () => ({ data: null }),
    }),
  }),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/checkout/route");
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1", email: "a@b.com" } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when STRIPE_SECRET_KEY is not set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { POST } = await loadRoute();

    const res = await POST(makeRequest({ plan: "solo" }));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Stripe is not configured");
    expect(data.message).toContain("STRIPE_SECRET_KEY");
  });

  it("returns 401 when the user is not authenticated", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await loadRoute();

    const res = await POST(makeRequest({ plan: "agency" }));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Not authenticated");
  });

  it("returns 400 for an invalid plan when authenticated", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    const { POST } = await loadRoute();

    const res = await POST(makeRequest({ plan: "bogus" }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid plan");
  });

  it("returns 400 for an invalid JSON body when authenticated", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    const { POST } = await loadRoute();

    const req = new NextRequest("http://localhost:3001/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 503 when the plan's Price ID env var is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_PRICE_AGENCY", "");
    const { POST } = await loadRoute();

    const res = await POST(makeRequest({ plan: "agency" }));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Price not configured");
    expect(data.message).toContain("STRIPE_PRICE_AGENCY");
  });
});
