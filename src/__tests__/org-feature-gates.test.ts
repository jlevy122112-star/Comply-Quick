import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isPremium: true }));

vi.mock("@/lib/entitlements", () => ({
  getOrgEntitlement: vi.fn(async () => ({ isPremium: state.isPremium })),
}));

describe("organization-aware feature gates", () => {
  beforeEach(() => {
    state.isPremium = true;
  });

  it("allows paid organization members through intelligence, Autopilot, and marketplace gates", async () => {
    const [{ canUseIntelligence }, { canUseAutopilot }, { canSell }] = await Promise.all([
      import("@/lib/intelligence/service"),
      import("@/lib/autopilot/service"),
      import("@/lib/marketplace/service"),
    ]);

    await expect(canUseIntelligence()).resolves.toBe(true);
    await expect(canUseAutopilot()).resolves.toBe(true);
    await expect(canSell()).resolves.toBe(true);
  });

  it("denies free organization members through the same gates", async () => {
    state.isPremium = false;
    const [{ canUseIntelligence }, { canUseAutopilot }, { canSell }] = await Promise.all([
      import("@/lib/intelligence/service"),
      import("@/lib/autopilot/service"),
      import("@/lib/marketplace/service"),
    ]);

    await expect(canUseIntelligence()).resolves.toBe(false);
    await expect(canUseAutopilot()).resolves.toBe(false);
    await expect(canSell()).resolves.toBe(false);
  });
});
