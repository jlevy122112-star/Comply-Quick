// Portfolio Monitoring Agent (agencies).
//
// Monitors every client project in an agency portfolio, flags "at-risk" clients
// against transparent thresholds, and drafts a client-ready report. Pure scoring
// + drafting logic so it's deterministic and testable; the executor persists the
// draft report and (on approval) sends it to the client.

import { action, orderPlan, type AgentActionPlan } from "./actions";

export type ProjectStatus = "current" | "action_needed" | "draft" | "archived";

export interface PortfolioProject {
  id: string;
  name: string;
  clientName: string;
  complianceScore: number;
  status: ProjectStatus;
  /** ISO date of the last scan/update; drives staleness. */
  lastUpdated: string;
  /** Count of open (unapproved) regulatory proposals. */
  pendingProposals: number;
}

export type RiskBand = "healthy" | "watch" | "at_risk";

export interface ClientRiskAssessment {
  projectId: string;
  clientName: string;
  band: RiskBand;
  score: number;
  reasons: string[];
}

const STALE_DAYS = 90;

function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/** Deterministically assesses one project's risk band with explainable reasons. */
export function assessProject(project: PortfolioProject, now: Date = new Date()): ClientRiskAssessment {
  const reasons: string[] = [];
  if (project.status === "action_needed") reasons.push("Has documents awaiting review");
  if (project.pendingProposals > 0) reasons.push(`${project.pendingProposals} pending regulatory update(s)`);
  if (project.complianceScore < 60) reasons.push(`Low compliance score (${project.complianceScore})`);
  else if (project.complianceScore < 80) reasons.push(`Compliance score below target (${project.complianceScore})`);
  const stale = daysSince(project.lastUpdated, now);
  if (stale > STALE_DAYS) reasons.push(`Not reviewed in ${stale} days`);

  let band: RiskBand = "healthy";
  if (project.complianceScore < 60 || project.status === "action_needed" || stale > STALE_DAYS) band = "at_risk";
  else if (project.complianceScore < 80 || project.pendingProposals > 0) band = "watch";

  return { projectId: project.id, clientName: project.clientName, band, score: project.complianceScore, reasons };
}

export interface PortfolioAssessment {
  assessments: ClientRiskAssessment[];
  atRisk: ClientRiskAssessment[];
  watch: ClientRiskAssessment[];
  plan: AgentActionPlan;
}

/**
 * Assesses the whole portfolio and drafts a plan that offers a client-ready
 * report for each at-risk client (retention: agencies keep clients by surfacing
 * and fixing risk before the client notices).
 */
export function monitorPortfolio(projects: PortfolioProject[], now: Date = new Date()): PortfolioAssessment {
  const assessments = projects.map((p) => assessProject(p, now));
  const atRisk = assessments.filter((a) => a.band === "at_risk");
  const watch = assessments.filter((a) => a.band === "watch");

  const actions = atRisk.map((a) =>
    action(
      "draft_client_report",
      `Draft a report for ${a.clientName}: ${a.reasons.join("; ")}.`,
      { projectId: a.projectId, clientName: a.clientName },
      a.score < 60 ? 30 : 20
    )
  );

  const rationale =
    atRisk.length > 0
      ? `${atRisk.length} client(s) are at risk and ${watch.length} need watching. Draft reports to get ahead of churn.`
      : `All ${projects.length} client(s) are healthy. No action needed.`;

  const plan = orderPlan({ agent: "portfolio_monitor", title: "Portfolio risk report", rationale, actions });
  return { assessments, atRisk, watch, plan };
}
