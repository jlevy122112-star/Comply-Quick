import { describe, expect, it } from "vitest";
import { organizationReadFilter } from "@/lib/organizations-db";

describe("organizationReadFilter", () => {
  it("keeps active-org reads limited to shared rows and own legacy rows", () => {
    expect(organizationReadFilter("user-1", "org-a")).toBe(
      "organization_id.eq.org-a,and(user_id.eq.user-1,organization_id.is.null)"
    );
  });

  it("keeps the legacy user-only filter when no organization is active", () => {
    expect(organizationReadFilter("user-1", null)).toBe("user_id.eq.user-1");
  });
});
