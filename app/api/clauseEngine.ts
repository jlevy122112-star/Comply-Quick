// app/api/clauseEngine.ts

const VALID_PERSONAS = ['developer', 'agency', 'merchant'] as const;
const VALID_TECH_STACK = ['Shopify', 'Klaviyo', 'Meta Pixel', 'Google Analytics'] as const;
const VALID_NEXUS = ['US-TX', 'US-CA', 'UK', 'EU'] as const;
const VALID_JURISDICTIONS = ['General US', 'California/CCPA', 'EU/GDPR'] as const;
const VALID_VERTICALS = ['Standard Apparel', 'Dietary Supplements', 'Kids Goods'] as const;

export type Persona = (typeof VALID_PERSONAS)[number];
export type TechStack = (typeof VALID_TECH_STACK)[number];
export type Nexus = (typeof VALID_NEXUS)[number];
export type Jurisdiction = (typeof VALID_JURISDICTIONS)[number];
export type Vertical = (typeof VALID_VERTICALS)[number];

export interface GenerationInput {
  persona: Persona;
  techStack: TechStack[];
  nexus: Nexus;
  jurisdictions: Jurisdiction[];
  vertical: Vertical;
}

export interface FreeCompliancePacket {
  inwardContractShield: string;
}

export interface PremiumCompliancePacket {
  outwardPrivacySnippets: string[];
  devChecklist: string[];
}

export function validateInput(input: unknown): input is GenerationInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;

  if (!VALID_PERSONAS.includes(obj.persona as Persona)) return false;
  if (!Array.isArray(obj.techStack) || obj.techStack.some((t: unknown) => !VALID_TECH_STACK.includes(t as TechStack))) return false;
  if (!VALID_NEXUS.includes(obj.nexus as Nexus)) return false;
  if (!Array.isArray(obj.jurisdictions) || obj.jurisdictions.some((j: unknown) => !VALID_JURISDICTIONS.includes(j as Jurisdiction))) return false;
  if (!VALID_VERTICALS.includes(obj.vertical as Vertical)) return false;

  return true;
}

export function generateFreePacket(input: GenerationInput): FreeCompliancePacket {
  let contractShield = `### MASTER LIABILITY LIMITATION & COMPLIANCE WAIVER\n\n`;
  contractShield += `This Compliance Waiver Amendment is entered into by the Service Provider and the Client. \n\n`;
  contractShield += `1. **Scope of Technical Implementation:** The Service Provider is contracted solely to implement technical integrations specified in the client brief, explicitly limited to: ${input.techStack.join(', ')}.\n\n`;
  contractShield += `2. **Client Legal Responsibility:** The Client acknowledges that the regulatory requirements governing data privacy, accessibility (including WCAG and ADA guidelines), and e-commerce consumer compliance vary drastically based on operational nexus (${input.nexus}) and targeted markets (${input.jurisdictions.join(', ')}). The Service Provider is not an attorney and does not offer formal legal counsel.\n\n`;
  contractShield += `3. **Final Verification Requirement:** Final legal validation, review of policy text, and validation of consumer consent mechanisms must be secured by the Client prior to deployment. The Service Provider accepts zero liability for statutory fines, regulatory audits, or civil claims resulting from accessibility or tracking compliance violations.`;

  return { inwardContractShield: contractShield };
}

/**
 * Premium content generation — must only be called server-side behind
 * payment / session verification.  Never import this in client components.
 */
export function generatePremiumPacket(input: GenerationInput): PremiumCompliancePacket {
  const outwardPrivacySnippets: string[] = [];
  const devChecklist: string[] = [];

  if (input.techStack.includes('Meta Pixel') || input.techStack.includes('Google Analytics')) {
    outwardPrivacySnippets.push(
      `**Third-Party Analytics and Marketing Tracking:** This platform utilizes tracking pixels to capture user interaction trends. Under dynamic regulations, explicitly including CCPA/CPRA and GDPR frameworks, third-party marketing tags are systematically blocked from executing payload transmission prior to affirmative user consent capture.`
    );
    devChecklist.push(
      `Ensure cookie banner settings utilize hard-blocking API integrations so the Meta/Google tracking scripts remain disabled until the user explicitly opts in.`
    );
  }

  if (input.jurisdictions.includes('EU/GDPR')) {
    outwardPrivacySnippets.push(
      `**EU Resident Rights (GDPR Declaration):** Data subjects retain structural rights to request explicit access, deletion, porting, or modification of telemetry recorded across this architecture. Requests may be initiated via standard support nodes.`
    );
    devChecklist.push(
      `CRITICAL DEV TASK: Implement standard automated consent management workflows natively using the platform Consent API to verify correct regional compliance flags.`
    );
  }

  if (input.vertical === 'Dietary Supplements') {
    devChecklist.push(
      `REGULATORY WARNING: Dietary supplements require explicit structural disclosures on checkout pages. Audit product landing descriptions to ensure explicit structural claims are decoupled from formal medical advice promises.`
    );
  }

  return { outwardPrivacySnippets, devChecklist };
}
