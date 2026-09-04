import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const addIntegration = vi.fn();
const setIntegrationActive = vi.fn();
const deleteIntegration = vi.fn();
const connectNativeIntegration = vi.fn();
const softRevokeNativeIntegration = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock("@/lib/integrations-db", () => ({
  addIntegration: (...args: unknown[]) => addIntegration(...args),
  setIntegrationActive: (...args: unknown[]) => setIntegrationActive(...args),
  deleteIntegration: (...args: unknown[]) => deleteIntegration(...args),
}));

vi.mock("@/lib/native-integrations-db", () => ({
  connectNativeIntegration: (...args: unknown[]) => connectNativeIntegration(...args),
  softRevokeNativeIntegration: (...args: unknown[]) => softRevokeNativeIntegration(...args),
}));

describe("settings integration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addIntegration.mockResolvedValue({ ok: true });
    setIntegrationActive.mockResolvedValue(true);
    deleteIntegration.mockResolvedValue(true);
    connectNativeIntegration.mockResolvedValue({ ok: true });
    softRevokeNativeIntegration.mockResolvedValue({ ok: true });
  });

  it("revalidates after native connect/disconnect", async () => {
    const { connectNativeIntegrationAction, disconnectNativeIntegrationAction } = await import(
      "@/app/dashboard/settings/integrations/actions"
    );
    await connectNativeIntegrationAction({
      workspaceId: "ws-1",
      platform: "wordpress",
      externalAccountId: "example.com",
    });
    await disconnectNativeIntegrationAction("native-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings/integrations");
    expect(connectNativeIntegration).toHaveBeenCalled();
    expect(softRevokeNativeIntegration).toHaveBeenCalledWith("native-1", undefined);
  });
});
