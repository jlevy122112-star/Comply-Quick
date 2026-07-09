import { describe, it, expect, afterEach } from "vitest";
import { buildSystemPrompt, answerAssistant } from "@/lib/assistant/service";
import { resetAiClientForTests } from "@/services/ai";

afterEach(() => resetAiClientForTests(undefined));

describe("buildSystemPrompt", () => {
  it("grounds the assistant in the live datasets and tool routes", () => {
    const prompt = buildSystemPrompt({ tier: "solo", projectCount: 3 });
    expect(prompt).toContain("/dashboard/tools/cookie-banner");
    expect(prompt).toContain("/dashboard/tools/dpa");
    expect(prompt).toContain("GDPR");
    expect(prompt).toContain("tier=solo");
  });

  it("grounds the assistant in the current regulatory-change feed", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Current regulatory developments");
    // A representative current development from the canonical feed.
    expect(prompt).toContain("EU AI Act");
  });
});

describe("answerAssistant (keyless fallback)", () => {
  it("returns a grounded, non-live answer that routes to the right tool", async () => {
    resetAiClientForTests({
      id: "test",
      live: false,
      complete: async () => "should not be used",
    });
    const res = await answerAssistant([{ role: "user", content: "Do I need a cookie banner?" }]);
    expect(res.live).toBe(false);
    expect(res.reply).toContain("/dashboard/tools/cookie-banner");
  });

  it("uses the live client when available", async () => {
    resetAiClientForTests({
      id: "test",
      live: true,
      complete: async () => "Here is your answer.",
    });
    const res = await answerAssistant([{ role: "user", content: "What is a DPA?" }]);
    expect(res.live).toBe(true);
    expect(res.reply).toBe("Here is your answer.");
  });
});
