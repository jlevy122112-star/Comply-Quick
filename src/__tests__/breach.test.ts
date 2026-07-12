import { describe, it, expect } from "vitest";
import {
  normalizeBreach,
  computeObligations,
  summarizeObligations,
  type NotifiableIncident,
} from "@/lib/privacy/breach";

const BASE = {
  title: "Exposed export",
  severity: "high",
  discoveredAt: "2026-01-01T00:00:00.000Z",
};

describe("normalizeBreach", () => {
  it("requires a title", () => {
    const r = normalizeBreach({ ...BASE, title: "   " });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid severity", () => {
    const r = normalizeBreach({ ...BASE, severity: "catastrophic" });
    expect(r.ok).toBe(false);
  });

  it("rejects a missing/invalid discoveredAt", () => {
    expect(normalizeBreach({ ...BASE, discoveredAt: "not-a-date" }).ok).toBe(false);
    expect(normalizeBreach({ title: "x", severity: "low" }).ok).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(normalizeBreach(null).ok).toBe(false);
    expect(normalizeBreach("nope").ok).toBe(false);
  });

  it("normalizes discoveredAt to ISO", () => {
    const r = normalizeBreach({ ...BASE, discoveredAt: "2026-01-01T00:00:00Z" });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.discoveredAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("filters unknown data categories and regions, dedupes", () => {
    const r = normalizeBreach({
      ...BASE,
      dataCategories: ["health", "HEALTH", "unknown", "financial"],
      regions: ["eu_gdpr", "eu_gdpr", "atlantis"],
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.dataCategories.sort()).toEqual(["financial", "health"]);
    expect(r.value.regions).toEqual(["eu_gdpr"]);
  });

  it("clamps affectedIndividuals to a non-negative integer", () => {
    expect(normalizeBreach({ ...BASE, affectedIndividuals: -5 }).ok).toBe(false);
    const r = normalizeBreach({ ...BASE, affectedIndividuals: 12.9 });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.affectedIndividuals).toBe(12);
  });

  it("coerces highRisk strictly to boolean true", () => {
    const t = normalizeBreach({ ...BASE, highRisk: true });
    const f = normalizeBreach({ ...BASE, highRisk: "true" });
    if (!t.ok || !f.ok) throw new Error("normalize failed");
    expect(t.value.highRisk).toBe(true);
    expect(f.value.highRisk).toBe(false);
  });

  it("rejects an invalid occurredAt but allows empty", () => {
    expect(normalizeBreach({ ...BASE, occurredAt: "bad" }).ok).toBe(false);
    const r = normalizeBreach({ ...BASE, occurredAt: "" });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.occurredAt).toBeNull();
  });
});

function incident(overrides: Partial<NotifiableIncident> = {}): NotifiableIncident {
  return {
    discoveredAt: "2026-01-01T00:00:00.000Z",
    regions: [],
    dataCategories: [],
    highRisk: false,
    authorityNotifiedAt: null,
    individualsNotifiedAt: null,
    ...overrides,
  };
}

describe("computeObligations", () => {
  it("derives the GDPR Art.33 72h authority deadline for EU incidents", () => {
    const obs = computeObligations(incident({ regions: ["eu_gdpr"] }), new Date("2026-01-01T01:00:00Z"));
    const art33 = obs.find((o) => o.id === "gdpr_art33_authority");
    expect(art33).toBeDefined();
    expect(art33?.dueAt).toBe("2026-01-04T00:00:00.000Z");
    expect(art33?.state).toBe("upcoming");
  });

  it("only adds the Art.34 individuals duty when high risk", () => {
    const low = computeObligations(incident({ regions: ["eu_gdpr"], highRisk: false }));
    expect(low.some((o) => o.id === "gdpr_art34_individuals")).toBe(false);
    const high = computeObligations(incident({ regions: ["eu_gdpr"], highRisk: true }));
    expect(high.some((o) => o.id === "gdpr_art34_individuals")).toBe(true);
  });

  it("adds the HIPAA 60-day duty when health data is involved", () => {
    const obs = computeObligations(incident({ dataCategories: ["health"] }));
    const hipaa = obs.find((o) => o.id === "hipaa_individuals");
    expect(hipaa).toBeDefined();
    expect(hipaa?.dueAt).toBe("2026-03-02T00:00:00.000Z");
  });

  it("adds a US state duty for us_general or california_ccpa", () => {
    expect(computeObligations(incident({ regions: ["us_general"] })).some((o) => o.id === "us_state_individuals")).toBe(
      true
    );
    expect(
      computeObligations(incident({ regions: ["california_ccpa"] })).some((o) => o.id === "us_state_individuals")
    ).toBe(true);
  });

  it("marks an obligation overdue once its deadline passes", () => {
    const obs = computeObligations(incident({ regions: ["eu_gdpr"] }), new Date("2026-01-05T00:00:00Z"));
    expect(obs.find((o) => o.id === "gdpr_art33_authority")?.state).toBe("overdue");
  });

  it("marks an obligation due_soon within 24h of the deadline", () => {
    const obs = computeObligations(incident({ regions: ["eu_gdpr"] }), new Date("2026-01-03T06:00:00Z"));
    expect(obs.find((o) => o.id === "gdpr_art33_authority")?.state).toBe("due_soon");
  });

  it("treats a recorded notification as met", () => {
    const obs = computeObligations(
      incident({ regions: ["eu_gdpr"], authorityNotifiedAt: "2026-01-02T00:00:00Z" }),
      new Date("2026-01-05T00:00:00Z")
    );
    expect(obs.find((o) => o.id === "gdpr_art33_authority")?.state).toBe("met");
  });

  it("surfaces no-fixed-clock duties (PIPEDA) as due_soon until met", () => {
    const obs = computeObligations(incident({ regions: ["canada_pipeda"] }));
    const pipeda = obs.find((o) => o.id === "pipeda_authority");
    expect(pipeda?.dueAt).toBeNull();
    expect(pipeda?.state).toBe("due_soon");
  });

  it("returns nothing when no jurisdiction or sensitive category applies", () => {
    expect(computeObligations(incident())).toEqual([]);
  });
});

describe("summarizeObligations", () => {
  it("counts states", () => {
    const obs = computeObligations(
      incident({ regions: ["eu_gdpr", "us_general"], highRisk: true, authorityNotifiedAt: "2026-01-02T00:00:00Z" }),
      new Date("2026-01-05T00:00:00Z")
    );
    const s = summarizeObligations(obs);
    expect(s.total).toBe(obs.length);
    expect(s.met + s.overdue + s.dueSoon).toBeLessThanOrEqual(s.total);
    expect(s.met).toBeGreaterThanOrEqual(1);
  });
});
