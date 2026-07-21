import { describe, expect, it } from "vitest";
import {
  AGENCY_ROLE_CAPABILITIES,
  AGENCY_ROLE_DESCRIPTIONS,
  AGENCY_ROLE_LABELS,
  assignableAgencyRoles,
  canAgency,
} from "@/lib/agency/roles";

describe("agency role capabilities", () => {
  it("gives admins full control, managers client control, and viewers read-only access", () => {
    expect(canAgency("owner", "manage_agency")).toBe(true);
    expect(canAgency("admin", "manage_clients")).toBe(true);
    expect(canAgency("account_manager", "manage_clients")).toBe(true);
    expect(canAgency("account_manager", "manage_agency")).toBe(false);
    expect(canAgency("client_viewer", "view_portfolio")).toBe(true);
    expect(canAgency("client_viewer", "manage_clients")).toBe(false);
  });

  it("keeps labels and descriptions available for every named role", () => {
    for (const role of Object.keys(AGENCY_ROLE_CAPABILITIES) as Array<keyof typeof AGENCY_ROLE_LABELS>) {
      expect(AGENCY_ROLE_LABELS[role]).toBeTruthy();
      expect(AGENCY_ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });

  it("does not allow a non-owner to assign above their own level", () => {
    expect(assignableAgencyRoles("account_manager")).toEqual(["account_manager", "client_viewer"]);
    expect(assignableAgencyRoles("client_viewer")).toEqual(["client_viewer"]);
    expect(assignableAgencyRoles("admin")).toEqual(["admin", "account_manager", "client_viewer"]);
    expect(assignableAgencyRoles("owner")).toContain("admin");
  });
});
