import { describe, it, expect } from "vitest";
import { controlsForFramework, FRAMEWORKS_WITH_STATIC_CONTROLS } from "@/lib/regulations/controls";
import { compileEvidencePack } from "@/lib/agents";

describe("static control catalog", () => {
  it("exposes proprietary frameworks with normalized controls", () => {
    expect(FRAMEWORKS_WITH_STATIC_CONTROLS).toContain("soc2");
    const soc2 = controlsForFramework("soc2");
    expect(soc2.length).toBeGreaterThan(0);
    for (const c of soc2) {
      expect(c.framework).toBe("soc2");
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      // Proprietary text is never reproduced.
      expect(c.sourceText).toBeNull();
    }
  });

  it("returns [] for full-text (ingestion-only) frameworks", () => {
    expect(controlsForFramework("hipaa")).toEqual([]);
  });

  it("compiles an evidence pack from the catalog + a ledger", () => {
    const controls = controlsForFramework("pci_dss");
    const firstId = controls[0].id;
    const pack = compileEvidencePack("pci_dss", controls, { [firstId]: true });
    expect(pack.totalControls).toBe(controls.length);
    expect(pack.collected).toBe(1);
    expect(pack.readiness).toBeGreaterThan(0);
    expect(pack.items.find((i) => i.controlId === firstId)?.status).toBe("collected");
  });
});
