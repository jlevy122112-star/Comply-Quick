import { describe, it, expect, beforeEach } from "vitest";
import {
  getSavedProjects,
  saveProject,
  deleteProject,
  generateProjectId,
  getPaidTier,
  setPaidTier,
  getAggregateScore,
  type SavedProject,
} from "@/lib/projects";

function makeMockProject(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    id: generateProjectId(),
    name: "Test Project",
    framework: "shopify",
    trackingPixels: ["meta"],
    targetRegions: ["us_general"],
    complianceModules: [],
    complianceScore: {
      overall: 75,
      contractProtection: 90,
      privacyCoverage: 70,
      preLaunchReadiness: 80,
      regulatoryBreadth: 60,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "current",
    packageMarkdown: "# Test Package",
    ...overrides,
  };
}

describe("projects localStorage utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getSavedProjects", () => {
    it("returns empty array when no projects saved", () => {
      expect(getSavedProjects()).toEqual([]);
    });

    it("returns saved projects from localStorage", () => {
      const project = makeMockProject({ id: "test-1" });
      localStorage.setItem("comply-quick-projects", JSON.stringify([project]));

      const result = getSavedProjects();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("test-1");
    });

    it("returns empty array for corrupted localStorage data", () => {
      localStorage.setItem("comply-quick-projects", "not-valid-json{{{");
      expect(getSavedProjects()).toEqual([]);
    });
  });

  describe("saveProject", () => {
    it("adds a new project to storage", () => {
      const project = makeMockProject({ id: "save-1" });
      saveProject(project);

      const saved = getSavedProjects();
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe("save-1");
    });

    it("prepends new projects (most recent first)", () => {
      saveProject(makeMockProject({ id: "first" }));
      saveProject(makeMockProject({ id: "second" }));

      const saved = getSavedProjects();
      expect(saved).toHaveLength(2);
      expect(saved[0].id).toBe("second");
      expect(saved[1].id).toBe("first");
    });

    it("updates an existing project by id", () => {
      saveProject(makeMockProject({ id: "update-me", name: "Original" }));
      saveProject(makeMockProject({ id: "update-me", name: "Updated" }));

      const saved = getSavedProjects();
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe("Updated");
    });
  });

  describe("deleteProject", () => {
    it("removes a project by id", () => {
      saveProject(makeMockProject({ id: "del-1" }));
      saveProject(makeMockProject({ id: "del-2" }));

      deleteProject("del-1");

      const saved = getSavedProjects();
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe("del-2");
    });

    it("handles deleting a non-existent id gracefully", () => {
      saveProject(makeMockProject({ id: "keep-me" }));
      deleteProject("does-not-exist");

      expect(getSavedProjects()).toHaveLength(1);
    });
  });

  describe("generateProjectId", () => {
    it("produces unique ids", () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateProjectId()));
      expect(ids.size).toBe(50);
    });

    it("starts with proj_ prefix", () => {
      expect(generateProjectId()).toMatch(/^proj_/);
    });
  });

  describe("getPaidTier / setPaidTier", () => {
    it("returns null when no tier is set", () => {
      expect(getPaidTier()).toBeNull();
    });

    it("stores and retrieves a tier", () => {
      setPaidTier("agency");
      expect(getPaidTier()).toBe("agency");
    });

    it("clears tier when set to null", () => {
      setPaidTier("enterprise");
      setPaidTier(null);
      expect(getPaidTier()).toBeNull();
    });
  });

  describe("getAggregateScore", () => {
    it("returns null for empty project list", () => {
      expect(getAggregateScore([])).toBeNull();
    });

    it("returns the single project score for a single project", () => {
      const project = makeMockProject({
        complianceScore: {
          overall: 80,
          contractProtection: 90,
          privacyCoverage: 70,
          preLaunchReadiness: 85,
          regulatoryBreadth: 75,
        },
      });
      const score = getAggregateScore([project]);

      expect(score).toEqual({
        overall: 80,
        contractProtection: 90,
        privacyCoverage: 70,
        preLaunchReadiness: 85,
        regulatoryBreadth: 75,
      });
    });

    it("averages scores across multiple projects", () => {
      const p1 = makeMockProject({
        complianceScore: {
          overall: 80,
          contractProtection: 100,
          privacyCoverage: 60,
          preLaunchReadiness: 80,
          regulatoryBreadth: 80,
        },
      });
      const p2 = makeMockProject({
        complianceScore: {
          overall: 60,
          contractProtection: 80,
          privacyCoverage: 40,
          preLaunchReadiness: 60,
          regulatoryBreadth: 60,
        },
      });
      const score = getAggregateScore([p1, p2]);

      expect(score!.overall).toBe(70);
      expect(score!.contractProtection).toBe(90);
      expect(score!.privacyCoverage).toBe(50);
      expect(score!.preLaunchReadiness).toBe(70);
      expect(score!.regulatoryBreadth).toBe(70);
    });
  });
});
