import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacesPanel } from "@/app/dashboard/settings/organization/WorkspacesPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/dashboard/settings/organization/actions", () => ({
  createWorkspaceAction: vi.fn(),
  deleteWorkspaceAction: vi.fn(),
  updateWorkspaceBrandingAction: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
    },
  }),
}));

describe("WorkspacesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows workspace branding controls for users who can update workspaces", () => {
    render(
      <WorkspacesPanel
        orgId="org-1"
        role="admin"
        workspaces={[
          {
            id: "ws-1",
            organizationId: "org-1",
            name: "Acme Workspace",
            slug: "acme-workspace",
            logoUrl: null,
            primaryColor: "#4f46e5",
            themePalette: "indigo",
            footerText: "Prepared by Acme Workspace.",
            projectCount: 2,
            createdAt: "2026-09-01T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Client deliverable branding")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Prepared by Acme Workspace.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save branding" })).toBeInTheDocument();
  });
});
