import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getActiveOrganizationId = vi.fn();
let maybeSingleCount = 0;
let awaitCount = 0;
const legacyFinding = {
  id: "legacy-finding",
  status: "open",
  organization_id: null,
  finding_key: "example.com::tracker",
};

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId,
  organizationReadFilter: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => {
      const builder = {
        select: () => builder,
        like: () => builder,
        eq: () => builder,
        is: () => builder,
        update: () => builder,
        insert: () => builder,
        single: async () => ({ data: null, error: { code: "23505" } }),
        maybeSingle: async () => {
          maybeSingleCount += 1;
          return { data: maybeSingleCount === 2 ? legacyFinding : null, error: null };
        },
        then: (resolve: (value: unknown) => unknown) => {
          awaitCount += 1;
          return Promise.resolve({
            data: awaitCount === 1 ? [] : null,
            error: null,
          }).then(resolve);
        },
      };
      return builder;
    },
  }),
}));

describe("legacy finding collision reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleCount = 0;
    awaitCount = 0;
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveOrganizationId.mockResolvedValue("org-1");
  });

  it("adopts a matching legacy row instead of dropping an org-scoped rescan", async () => {
    const { materializeScanFindings } = await import("@/lib/findings-db");

    await expect(
      materializeScanFindings(
        "scan-1",
        "https://example.com",
        [
          {
            id: "tracker",
            title: "Tracker",
            severity: "critical",
            detail: "A tracker was detected.",
            recommendation: "Review the tracker.",
          },
        ],
        null
      )
    ).resolves.toBeUndefined();
  });
});
