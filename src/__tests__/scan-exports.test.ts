import { describe, expect, it } from "vitest";
import { buildScanExportFile, prepareScanExport, renderScanExportText } from "@/lib/workspace/scan-exports";
import type { ScanRecord } from "@/lib/scanner/service";
import { resolveWorkspaceDeliverableBranding } from "@/lib/workspace/branding";
import { buildScanTimeline } from "@/lib/workspace/scan-results";

function makeScan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    id: "scan-1",
    projectId: "project-1",
    url: "https://client.example.com",
    status: "completed",
    score: 84,
    detectedTools: [{ id: "ga4", name: "Google Analytics" }],
    findings: [
      {
        id: "trackers_without_consent",
        title: "Trackers load without a consent banner",
        severity: "critical",
        detail: "Detected trackers without consent tooling.",
        recommendation: "Add a consent banner.",
      },
    ],
    accessibility: null,
    summary: "High-level summary for the customer.",
    error: null,
    organizationId: "org-1",
    clientId: null,
    sharedToken: null,
    sharedAt: null,
    emailedAt: null,
    createdAt: "2026-09-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("scan exports", () => {
  it("prefers workspace branding over organization branding", () => {
    const branding = resolveWorkspaceDeliverableBranding({
      workspace: {
        name: "Client Success Workspace",
        logoUrl: "https://cdn.example.com/workspace.png",
        primaryColor: "#112233",
        themePalette: "ocean",
        footerText: "Workspace footer",
      },
      organization: {
        name: "Org Brand",
        logoUrl: "https://cdn.example.com/org.png",
        primaryColor: "#abcdef",
        themePalette: "emerald",
        supportEmail: "support@example.com",
      },
    });

    expect(branding.name).toBe("Client Success Workspace");
    expect(branding.logoUrl).toBe("https://cdn.example.com/workspace.png");
    expect(branding.primaryColor).toBe("#112233");
    expect(branding.footerText).toBe("Workspace footer");
    expect(branding.supportEmail).toBe("support@example.com");
  });

  it("builds branded text and pdf exports from the canonical scan report", () => {
    const scan = makeScan();
    const branding = resolveWorkspaceDeliverableBranding({
      workspace: {
        name: "Acme Workspace",
        logoUrl: null,
        primaryColor: "#4f46e5",
        themePalette: "indigo",
        footerText: "Prepared for Acme stakeholders.",
      },
      organization: null,
    });
    const [timelineItem] = buildScanTimeline([scan]);

    const prepared = prepareScanExport({
      projectId: "project-1",
      projectName: "Acme Site",
      generatedAt: "2026-09-04T12:30:00.000Z",
      scan,
      timelineItem,
      branding,
    });
    const text = renderScanExportText(prepared);
    const pdf = buildScanExportFile("pdf", {
      projectId: "project-1",
      projectName: "Acme Site",
      generatedAt: "2026-09-04T12:30:00.000Z",
      scan,
      timelineItem,
      branding,
    });

    expect(text).toContain("Acme Workspace Compliance Report");
    expect(text).toContain("GDPR Findings");
    expect(text).toContain("Prepared for Acme stakeholders.");
    expect(pdf.contentType).toBe("application/pdf");
    expect(pdf.fileName).toMatch(/acme-workspace-acme-site-client-example-com\.pdf$/);
    expect(pdf.content).toBeInstanceOf(Uint8Array);
  });
});
