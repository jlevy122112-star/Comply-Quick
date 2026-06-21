// app/api/clauseEngine.ts

export interface GenerationInput {
  persona: 'developer' | 'agency' | 'merchant';
  techStack: string[];
  nexus: string;
  jurisdictions: string[];
  vertical: string;
}

export interface CompliancePacket {
  inwardContractShield: string;
  outwardPrivacySnippets: string[];
  devChecklist: string[];
}

export function generateCompliancePacket(input: GenerationInput): CompliancePacket {
  let contractShield = `### MASTER LIABILITY LIMITATION & COMPLIANCE WAIVER\n\n`;
  contractShield += `This Compliance Waiver Amendment is entered into by the Service Provider and the Client. \n\n`;
  contractShield += `1. **Scope of Technical Implementation:** The Service Provider is contracted solely to implement technical integrations specified in the client brief, explicitly limited to: ${input.techStack.join(', ')}.\n\n`;
  contractShield += `2. **Client Legal Responsibility:** The Client acknowledges that the regulatory requirements governing data privacy, accessibility (including WCAG and ADA guidelines), and e-commerce consumer compliance vary drastically based on operational nexus (${input.nexus}) and targeted markets (${input.jurisdictions.join(', ')}). The Service Provider is not an attorney and does not offer formal legal counsel.\n\n`;
  contractShield += `3. **Final Verification Requirement:** Final legal validation, review of policy text, and validation of consumer consent mechanisms must be secured by the Client prior to deployment. The Service Provider accepts zero liability for statutory fines, regulatory audits, or civil claims resulting from accessibility or tracking compliance violations.`;

  let outwardPrivacySnippets: string[] = [];
  let devChecklist: string[] = [];

  // Evaluate Tracking Pixels & Consent Logic
  if (input.techStack.includes('Meta Pixel') || input.techStack.includes('Google Analytics')) {
    outwardPrivacySnippets.push(
      `**Third-Party Analytics and Marketing Tracking:** This platform utilizes tracking pixels to capture user interaction trends. Under dynamic regulations, explicitly including CCPA/CPRA and GDPR frameworks, third-party marketing tags are systematically blocked from executing payload transmission prior to affirmative user consent capture.`
    );
    devChecklist.push(
      `Ensure cookie banner settings utilize hard-blocking API integrations so the Meta/Google tracking scripts remain disabled until the user explicitly opts in.`
    );
  }

  // Evaluate Regional Rulesets
  if (input.jurisdictions.includes('EU/GDPR')) {
    outwardPrivacySnippets.push(
      `**EU Resident Rights (GDPR Declaration):** Data subjects retain structural rights to request explicit access, deletion, porting, or modification of telemetry recorded across this architecture. Requests may be initiated via standard support nodes.`
    );
    devChecklist.push(
      `CRITICAL DEV TASK: Implement standard automated consent management workflows natively using the platform Consent API to verify correct regional compliance flags.`
    );
  }

  // Evaluate High-Risk Product Verticals
  if (input.vertical === 'Dietary Supplements') {
    devChecklist.push(
      `REGULATORY WARNING: Dietary supplements require explicit structural disclosures on checkout pages. Audit product landing descriptions to ensure explicit structural claims are decoupled from formal medical advice promises.`
    );
  }

  return {
    inwardContractShield: contractShield,
    outwardPrivacySnippets,
    devChecklist,
  };
}
