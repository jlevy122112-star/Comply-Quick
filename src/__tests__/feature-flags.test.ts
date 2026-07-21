import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/organizations-db", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user_1" } } }) },
    from: mocks.from,
  }),
}));

import {
  isFeatureEnabled,
  getFeatureFlag,
  listFeatureFlags,
  setFeatureFlag,
  type FeatureFlag,
} from "@/lib/feature-flags";

function makeQuery(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) {
    builder[m] = () => builder;
  }
  builder.maybeSingle = async () => result;
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return builder;
}

describe("feature-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(makeQuery({ data: null }));
  });

  it("uses plan defaults when no override exists", () => {
    expect(isFeatureEnabled("enterpriseHierarchy", "enterprise", null)).toBe(true);
    expect(isFeatureEnabled("enterpriseHierarchy", "agency", null)).toBe(false);
    expect(isFeatureEnabled("enterpriseHierarchy", "free", null)).toBe(false);
    expect(isFeatureEnabled("agencyPortal", "agency", null)).toBe(true);
    expect(isFeatureEnabled("agencyPortal", "free", null)).toBe(false);
  });

  it("honors tenant overrides over plan defaults", () => {
    expect(isFeatureEnabled("enterpriseHierarchy", "agency", true)).toBe(true);
    expect(isFeatureEnabled("enterpriseHierarchy", "enterprise", false)).toBe(false);
  });

  it("resolves a feature flag from the org plan", async () => {
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      plan: "enterprise",
      parentOrganizationId: null,
      isPersonal: false,
    });

    const enabled = await getFeatureFlag("org_1", "enterpriseHierarchy");
    expect(enabled).toBe(true);
  });

  it("lists all features with their effective values", async () => {
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      plan: "agency",
      parentOrganizationId: null,
      isPersonal: false,
    });
    mocks.from.mockReturnValue(
      makeQuery({
        data: [{ flag: "enterpriseHierarchy", enabled: true }],
      })
    );

    const flags = await listFeatureFlags("org_1");
    const hierarchy = flags.find((f) => f.flag === "enterpriseHierarchy")!;
    expect(hierarchy.enabled).toBe(true);
    expect(hierarchy.source).toBe("override");
  });

  it("persists a feature override", async () => {
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      plan: "enterprise",
      parentOrganizationId: null,
      isPersonal: false,
    });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: upsertMock });

    const res = await setFeatureFlag("org_1", "siemExport" as FeatureFlag, true, "SOC 2 requirement");

    expect(res).toEqual({ ok: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org_1", flag: "siemExport", enabled: true }),
      expect.anything()
    );
  });
});
