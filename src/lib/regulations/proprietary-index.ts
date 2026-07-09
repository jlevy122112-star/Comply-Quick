// Public control index for proprietary frameworks.
//
// SOC 2 (AICPA), ISO/IEC 27001 (ISO), and PCI DSS (PCI SSC) license their
// normative text, so we do NOT store it. What we can reference are the public,
// factual control identifiers and their categories, paired with our own short,
// original summaries (never the standards' verbatim prose). This lets the app
// map, gap-analyze, and link to these frameworks while directing users to the
// official source for the licensed control text.

import type { RegulationFrameworkId } from "./sources/registry";
import type { RiskLevel } from "./types";

export interface ProprietaryControlEntry {
  id: string;
  title: string;
  /** Our own one-line summary of the control area — not the standard's text. */
  summary: string;
  riskLevel: RiskLevel;
}

export const PROPRIETARY_CONTROL_INDEX: Partial<Record<RegulationFrameworkId, ProprietaryControlEntry[]>> = {
  soc2: [
    {
      id: "CC1",
      title: "Control Environment",
      summary: "Integrity, ethics, governance, and organizational accountability structures.",
      riskLevel: "medium",
    },
    {
      id: "CC2",
      title: "Communication & Information",
      summary: "How the entity generates and shares information supporting internal control.",
      riskLevel: "low",
    },
    {
      id: "CC3",
      title: "Risk Assessment",
      summary: "Identifying and analyzing risks to achieving security objectives.",
      riskLevel: "high",
    },
    {
      id: "CC4",
      title: "Monitoring Activities",
      summary: "Ongoing and separate evaluations of whether controls operate effectively.",
      riskLevel: "medium",
    },
    {
      id: "CC5",
      title: "Control Activities",
      summary: "Policies and procedures that mitigate identified risks.",
      riskLevel: "medium",
    },
    {
      id: "CC6",
      title: "Logical & Physical Access Controls",
      summary: "Restricting logical and physical access to systems and data.",
      riskLevel: "high",
    },
    {
      id: "CC7",
      title: "System Operations",
      summary: "Detecting, responding to, and recovering from operational incidents.",
      riskLevel: "high",
    },
    {
      id: "CC8",
      title: "Change Management",
      summary: "Authorizing, designing, testing, and deploying system changes.",
      riskLevel: "medium",
    },
    {
      id: "CC9",
      title: "Risk Mitigation",
      summary: "Mitigating risk from business disruptions and vendor relationships.",
      riskLevel: "medium",
    },
  ],
  iso_27001: [
    {
      id: "A.5",
      title: "Organizational Controls",
      summary: "Policies, roles, supplier and information-security governance controls.",
      riskLevel: "medium",
    },
    {
      id: "A.6",
      title: "People Controls",
      summary: "Screening, awareness, responsibilities, and post-employment obligations.",
      riskLevel: "medium",
    },
    {
      id: "A.7",
      title: "Physical Controls",
      summary: "Secure areas, equipment protection, and physical entry safeguards.",
      riskLevel: "medium",
    },
    {
      id: "A.8",
      title: "Technological Controls",
      summary: "Access management, cryptography, logging, and secure development controls.",
      riskLevel: "high",
    },
  ],
  pci_dss: [
    {
      id: "REQ-1",
      title: "Network Security Controls",
      summary: "Install and maintain controls that govern network traffic to cardholder data.",
      riskLevel: "high",
    },
    {
      id: "REQ-2",
      title: "Secure Configurations",
      summary: "Apply secure configuration baselines to all system components.",
      riskLevel: "medium",
    },
    {
      id: "REQ-3",
      title: "Protect Stored Account Data",
      summary: "Minimize and protect stored cardholder data.",
      riskLevel: "high",
    },
    {
      id: "REQ-4",
      title: "Protect Data in Transit",
      summary: "Use strong cryptography when transmitting cardholder data over open networks.",
      riskLevel: "high",
    },
    {
      id: "REQ-5",
      title: "Anti-Malware",
      summary: "Protect all systems and networks from malicious software.",
      riskLevel: "medium",
    },
    {
      id: "REQ-6",
      title: "Secure Systems & Software",
      summary: "Develop and maintain secure systems through patching and secure coding.",
      riskLevel: "high",
    },
    {
      id: "REQ-7",
      title: "Restrict Access by Need-to-Know",
      summary: "Limit access to system components and data to those who need it.",
      riskLevel: "high",
    },
    {
      id: "REQ-8",
      title: "Identify & Authenticate Access",
      summary: "Assign unique identities and authenticate all access to components.",
      riskLevel: "high",
    },
    {
      id: "REQ-9",
      title: "Restrict Physical Access",
      summary: "Restrict physical access to cardholder data and media.",
      riskLevel: "medium",
    },
    {
      id: "REQ-10",
      title: "Log & Monitor Access",
      summary: "Log and monitor all access to system components and data.",
      riskLevel: "high",
    },
    {
      id: "REQ-11",
      title: "Test Security Regularly",
      summary: "Regularly test security systems, networks, and processes.",
      riskLevel: "medium",
    },
    {
      id: "REQ-12",
      title: "Security Policy & Program",
      summary: "Maintain organizational information-security policies and programs.",
      riskLevel: "low",
    },
  ],
};
