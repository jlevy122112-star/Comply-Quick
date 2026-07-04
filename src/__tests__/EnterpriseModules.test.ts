import { describe, it, expect } from "vitest";
import { generateModuleOutputs, type ComplianceModule } from "@/components/EnterpriseModules";

describe("generateModuleOutputs", () => {
  it("returns outputs for all requested modules", () => {
    const modules: ComplianceModule[] = ["hipaa", "pci_dss", "ada_wcag", "soc2"];
    const outputs = generateModuleOutputs(modules);

    expect(outputs).toHaveLength(4);
  });

  it("returns correct structure for HIPAA module", () => {
    const outputs = generateModuleOutputs(["hipaa"]);

    expect(outputs).toHaveLength(1);
    const hipaa = outputs[0];
    expect(hipaa.moduleName).toBe("HIPAA Compliance Shield");
    expect(hipaa.summary).toContain("HIPAA");
    expect(hipaa.clauses.length).toBe(4);
    expect(hipaa.checklistItems.length).toBe(8);

    const clauseTitles = hipaa.clauses.map((c) => c.title);
    expect(clauseTitles).toContain("Business Associate Agreement (BAA) Requirement");
    expect(clauseTitles).toContain("PHI Data Handling & Encryption Standards");
    expect(clauseTitles).toContain("Breach Notification Protocol");
    expect(clauseTitles).toContain("Minimum Necessary Standard");
  });

  it("returns correct structure for PCI-DSS module", () => {
    const outputs = generateModuleOutputs(["pci_dss"]);

    expect(outputs).toHaveLength(1);
    const pci = outputs[0];
    expect(pci.moduleName).toBe("PCI-DSS Payment Security Shield");
    expect(pci.clauses.length).toBeGreaterThan(0);
    expect(pci.checklistItems.length).toBeGreaterThan(0);
  });

  it("returns correct structure for ADA/WCAG module", () => {
    const outputs = generateModuleOutputs(["ada_wcag"]);

    expect(outputs).toHaveLength(1);
    const ada = outputs[0];
    expect(ada.moduleName).toBe("ADA / WCAG Accessibility Compliance Shield");
    expect(ada.clauses.length).toBeGreaterThan(0);
    expect(ada.checklistItems.length).toBeGreaterThan(0);
  });

  it("returns correct structure for SOC 2 module", () => {
    const outputs = generateModuleOutputs(["soc2"]);

    expect(outputs).toHaveLength(1);
    const soc2 = outputs[0];
    expect(soc2.moduleName).toBe("SOC 2 Type II Security Controls Shield");
    expect(soc2.clauses.length).toBeGreaterThan(0);
    expect(soc2.checklistItems.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty modules list", () => {
    const outputs = generateModuleOutputs([]);
    expect(outputs).toHaveLength(0);
  });

  it("preserves order of requested modules", () => {
    const outputs = generateModuleOutputs(["soc2", "hipaa"]);

    expect(outputs).toHaveLength(2);
    expect(outputs[0].moduleName).toContain("SOC 2");
    expect(outputs[1].moduleName).toContain("HIPAA");
  });

  it("each module has non-empty clause bodies", () => {
    const allModules: ComplianceModule[] = ["hipaa", "pci_dss", "ada_wcag", "soc2"];
    const outputs = generateModuleOutputs(allModules);

    for (const output of outputs) {
      for (const clause of output.clauses) {
        expect(clause.title.length).toBeGreaterThan(0);
        expect(clause.body.length).toBeGreaterThan(0);
      }
      for (const item of output.checklistItems) {
        expect(item.length).toBeGreaterThan(0);
      }
    }
  });
});
