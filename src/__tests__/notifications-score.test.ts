import { describe, it, expect, vi } from "vitest";
import {
  applyRegulatoryImpact,
  regulatoryImpactMessage,
  type PendingRegulatoryPressure,
} from "@/lib/regulations/score-impact";
import { dispatchNotification, type NotificationRecipient, type NotificationEvent } from "@/lib/notifications/dispatch";

const p = (riskLevel: PendingRegulatoryPressure["riskLevel"], id: string = riskLevel): PendingRegulatoryPressure => ({
  regulationId: id,
  law: id,
  riskLevel,
});

describe("applyRegulatoryImpact", () => {
  it("does not change the score when nothing is pending", () => {
    const adj = applyRegulatoryImpact(88, []);
    expect(adj.adjustedScore).toBe(88);
    expect(adj.actionNeeded).toBe(false);
  });

  it("lowers the score for a pending high-risk change", () => {
    const adj = applyRegulatoryImpact(90, [p("high")]);
    expect(adj.adjustedScore).toBe(76); // 90 - 14
    expect(adj.actionNeeded).toBe(true);
  });

  it("applies diminishing penalties for multiple changes", () => {
    const adj = applyRegulatoryImpact(100, [p("high", "a"), p("high", "b")]);
    // 14*1 + 14*0.6 = 22.4 → 22
    expect(adj.penalty).toBe(22);
    expect(adj.adjustedScore).toBe(78);
  });

  it("caps the total penalty and never goes below zero", () => {
    const many = Array.from({ length: 10 }, (_, i) => p("high", `r${i}`));
    const adj = applyRegulatoryImpact(20, many);
    expect(adj.penalty).toBeLessThanOrEqual(35);
    expect(adj.adjustedScore).toBeGreaterThanOrEqual(0);
  });

  it("clamps an out-of-range base score", () => {
    expect(applyRegulatoryImpact(140, []).baseScore).toBe(100);
    expect(applyRegulatoryImpact(-5, []).baseScore).toBe(0);
  });

  it("produces a sign-in-oriented message when action is needed", () => {
    const msg = regulatoryImpactMessage(applyRegulatoryImpact(90, [p("high")]));
    expect(msg).toMatch(/sign in/i);
  });
});

describe("dispatchNotification", () => {
  const recipient: NotificationRecipient = { email: "u@example.com", pushTokens: ["ExpoTok"] };
  const event: NotificationEvent = {
    userId: "u1",
    category: "regulation_change",
    title: "GDPR updated",
    body: "Review your documents.",
    url: "https://app/dashboard/autopilot",
  };

  it("is a no-op per channel when providers are unconfigured", async () => {
    const fetchImpl = vi.fn();
    const res = await dispatchNotification(recipient, event, { fetchImpl: fetchImpl as never, env: {} });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.results.every((r) => !r.delivered)).toBe(true);
    expect(res.results.find((r) => r.channel === "email")?.reason).toBe("not_configured");
  });

  it("skips muted categories entirely", async () => {
    const fetchImpl = vi.fn();
    const res = await dispatchNotification({ ...recipient, mutedCategories: ["regulation_change"] }, event, {
      fetchImpl: fetchImpl as never,
      env: { RESEND_API_KEY: "k", NOTIFICATIONS_FROM_EMAIL: "a@b.c" },
    });
    expect(res.muted).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends email + push when configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const res = await dispatchNotification(recipient, event, {
      fetchImpl: fetchImpl as never,
      env: { RESEND_API_KEY: "k", NOTIFICATIONS_FROM_EMAIL: "a@b.c", EXPO_ACCESS_TOKEN: "t" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.results.filter((r) => r.delivered)).toHaveLength(2);
  });

  it("reports channel failure without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const res = await dispatchNotification(recipient, event, {
      fetchImpl: fetchImpl as never,
      env: { RESEND_API_KEY: "k", NOTIFICATIONS_FROM_EMAIL: "a@b.c", EXPO_ACCESS_TOKEN: "t" },
    });
    expect(res.results.find((r) => r.channel === "email")?.reason).toBe("http_500");
  });
});
