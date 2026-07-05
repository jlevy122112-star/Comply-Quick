import { describe, it, expect, vi } from "vitest";
import { SlackClient, formatSlackPayload, type SlackAlert } from "@/services/slack";

const alert: SlackAlert = {
  title: "Charge failed",
  message: "Your card was declined.",
  severity: "critical",
  fields: { Customer: "cus_123", Amount: "12.00 USD", Empty: "", Missing: undefined },
};

describe("formatSlackPayload", () => {
  it("renders a headline, message, and non-empty fields as Block Kit", () => {
    const payload = formatSlackPayload(alert);
    expect(payload.text).toContain("Charge failed");
    expect(payload.text).toContain("Your card was declined.");
    // First block is the headline/message section.
    const section = payload.blocks[0] as { text: { text: string } };
    expect(section.text.text).toContain("*Charge failed*");
    // Empty / undefined fields are dropped; only Customer + Amount remain.
    const fieldsBlock = payload.blocks[1] as { fields: { text: string }[] };
    expect(fieldsBlock.fields).toHaveLength(2);
    expect(fieldsBlock.fields.map((f) => f.text).join(" ")).toContain("cus_123");
  });

  it("omits the fields block entirely when there are no usable fields", () => {
    const payload = formatSlackPayload({ title: "t", message: "m" });
    expect(payload.blocks).toHaveLength(1);
  });
});

describe("SlackClient", () => {
  it("is a no-op when no webhook is configured", async () => {
    const client = new SlackClient({ webhookUrl: undefined, fetchImpl: vi.fn() });
    expect(client.enabled).toBe(false);
    const res = await client.send(alert);
    expect(res).toEqual({ delivered: false, reason: "not_configured" });
  });

  it("POSTs the payload as JSON to the webhook on success", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const client = new SlackClient({ webhookUrl: "https://hooks.slack.test/abc", fetchImpl });
    const res = await client.send(alert);
    expect(res.delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.slack.test/abc");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string).text).toContain("Charge failed");
  });

  it("reports non-2xx responses without throwing", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 404 }));
    const client = new SlackClient({ webhookUrl: "https://hooks.slack.test/abc", fetchImpl });
    const res = await client.send(alert);
    expect(res).toEqual({ delivered: false, reason: "http_404" });
  });

  it("swallows transport errors and reports the reason", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const client = new SlackClient({ webhookUrl: "https://hooks.slack.test/abc", fetchImpl });
    const res = await client.send(alert);
    expect(res).toEqual({ delivered: false, reason: "network down" });
  });
});
