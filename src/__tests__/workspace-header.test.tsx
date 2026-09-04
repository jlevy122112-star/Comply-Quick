import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceHeader } from "@/app/dashboard/projects/[id]/panels/WorkspaceHeader";

describe("WorkspaceHeader", () => {
  it("shows the active workspace context prominently", () => {
    render(
      <WorkspaceHeader
        project={{
          id: "project-1",
          workspaceId: "ws-1",
          name: "Client Portal",
          framework: "nextjs",
          trackingPixels: [],
          targetRegions: ["eu_gdpr"],
          complianceModules: ["hipaa"],
          complianceScore: {
            overall: 88,
            contractProtection: 86,
            privacyCoverage: 90,
            preLaunchReadiness: 84,
            regulatoryBreadth: 92,
          },
          status: "current",
          packageMarkdown: "",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
        }}
        workspace={{
          id: "ws-1",
          organizationId: "org-1",
          name: "Acme Workspace",
          slug: "acme-workspace",
          logoUrl: null,
          primaryColor: "#4f46e5",
          themePalette: "indigo",
          footerText: "Prepared by Acme Workspace.",
          projectCount: 3,
          createdAt: "2026-09-01T00:00:00.000Z",
        }}
        pendingCount={2}
        basePath="/dashboard/projects/project-1"
      />
    );

    expect(screen.getByText("Active workspace: Acme Workspace")).toBeInTheDocument();
    expect(screen.getByText("Workspace slug: acme-workspace")).toBeInTheDocument();
  });
});
