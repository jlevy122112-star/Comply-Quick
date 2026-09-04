import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsManager } from "@/app/dashboard/settings/integrations/IntegrationsManager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/dashboard/settings/integrations/actions", () => ({
  addIntegrationAction: vi.fn().mockResolvedValue({ ok: true }),
  setIntegrationActiveAction: vi.fn().mockResolvedValue(undefined),
  deleteIntegrationAction: vi.fn().mockResolvedValue(undefined),
  connectNativeIntegrationAction: vi.fn().mockResolvedValue({ ok: true }),
  disconnectNativeIntegrationAction: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("IntegrationsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders first-class native and advanced webhook sections", () => {
    render(
      <IntegrationsManager
        canManage
        workspaces={[
          {
            id: "ws-1",
            organizationId: "org-1",
            name: "Default",
            slug: "default",
            projectCount: 2,
            createdAt: "2026-01-01",
          },
        ]}
        clients={[{ id: "client-1", name: "Client A" }]}
        nativeIntegrations={[
          {
            id: "n-1",
            organizationId: "org-1",
            workspaceId: "ws-1",
            clientSeatId: "client-1",
            platform: "wordpress",
            status: "active",
            mode: "propose_only",
            externalAccountId: "example.com",
            installMetadata: {},
            connectedAt: "2026-01-01T00:00:00.000Z",
            disconnectedAt: null,
            revokedReason: null,
            lastVerifiedAt: null,
            lastSyncAt: null,
            lastError: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
        integrations={[
          {
            id: "w-1",
            kind: "webhook",
            name: "Ops",
            targetUrl: "https://hooks.example",
            active: true,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
      />
    );
    expect(screen.getByText("First-Class Integrations")).toBeInTheDocument();
    expect(screen.getByText("Advanced / Custom Integrations")).toBeInTheDocument();
    expect(screen.getAllByText("WordPress").length).toBeGreaterThan(0);
    expect(screen.getByText("Ops")).toBeInTheDocument();
  });
});
