import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockGetActiveOrganizationId = vi.fn();
const mockGetMyOrgRole = vi.fn();
const mockCan = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId: mockGetActiveOrganizationId,
  getMyOrgRole: mockGetMyOrgRole,
}));

vi.mock("@/lib/rbac", () => ({ can: mockCan }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

function makeRequest() {
  return new NextRequest("http://localhost:3001/api/billing-portal", { method: "POST" });
}

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/billing-portal/route");
}

describe("POST /api/billing-portal", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1", email: "user@example.com" } } });
    mockGetActiveOrganizationId.mockReset();
    mockGetActiveOrganizationId.mockResolvedValue("org_1");
    mockGetMyOrgRole.mockReset();
    mockGetMyOrgRole.mockResolvedValue("owner");
    mockCan.mockReset();
    mockCan.mockReturnValue(true);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await loadRoute();

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks org billing permission", async () => {
    mockCan.mockReturnValue(false);
    const { POST } = await loadRoute();

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 404 when no org billing account exists", async () => {
    const { POST } = await loadRoute();

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });
});
