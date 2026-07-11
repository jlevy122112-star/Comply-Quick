import { describe, expect, it, vi } from "vitest";
import { leadMagnetEmail, welcomeEmail, returningCustomerEmail } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/send";
import { FOUNDING_COUPON_CODE } from "@/lib/promo";

describe("email templates", () => {
  it("lead magnet omits the coupon for non-founding signups", () => {
    const { html, text, subject } = leadMagnetEmail();
    expect(subject).toContain("free compliance scan");
    expect(html).not.toContain(FOUNDING_COUPON_CODE);
    expect(text).not.toContain(FOUNDING_COUPON_CODE);
  });

  it("lead magnet includes the founding coupon when qualified", () => {
    const { html, text, subject } = leadMagnetEmail({
      foundingCode: FOUNDING_COUPON_CODE,
      foundingReward: "a free premium scan",
    });
    expect(subject).toContain("founding member");
    expect(html).toContain(FOUNDING_COUPON_CODE);
    expect(text).toContain(FOUNDING_COUPON_CODE);
  });

  it("escapes an untrusted first name", () => {
    const { html } = welcomeEmail("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returning-customer email renders a dashboard CTA", () => {
    const { html } = returningCustomerEmail("Maya");
    expect(html).toContain("Hi Maya,");
    expect(html).toContain("/dashboard");
  });
});

describe("sendTransactionalEmail", () => {
  const content = { to: "user@example.com", subject: "s", html: "<p>h</p>", text: "h" };

  it("is a safe no-op when Resend is not configured", async () => {
    const fetchImpl = vi.fn();
    const result = await sendTransactionalEmail(content, { env: {}, fetchImpl });
    expect(result).toEqual({ delivered: false, reason: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts to Resend and reports delivery when configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const result = await sendTransactionalEmail(content, {
      env: { RESEND_API_KEY: "re_test", NOTIFICATIONS_FROM_EMAIL: "hi@comply-quick.com" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reports a failure reason on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    const result = await sendTransactionalEmail(content, {
      env: { RESEND_API_KEY: "re_test", NOTIFICATIONS_FROM_EMAIL: "hi@comply-quick.com" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ delivered: false, reason: "http_422" });
  });
});
