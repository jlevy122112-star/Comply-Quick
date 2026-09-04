import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GitHubIntegrationTool from "@/app/dashboard/tools/github/GitHubIntegrationTool";

describe("GitHubIntegrationTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders install flows when no GitHub App is connected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ connected: false, repos: [], recentScans: [], recentPushEvents: [] }),
    } as Response);

    render(<GitHubIntegrationTool />);

    await waitFor(() => {
      expect(screen.getByText("Organization install flow")).toBeInTheDocument();
    });
    expect(screen.getByText("Repository install flow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install for organization" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install for repository" })).toBeInTheDocument();
  });
});
