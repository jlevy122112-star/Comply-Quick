import {
  COMPANY_LEGAL_NAME,
  COMPANY_TRADE_NAME,
  GOVERNING_LAW_CLAUSE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
  SUPPORT_EMAIL,
  VENUE_CLAUSE,
} from "@/lib/company";

/**
 * Mandatory disclaimer that must appear on every piece of generated content
 * (compliance packages, exported reports, public score pages). Wording is
 * fixed by the build plan — do not paraphrase per-surface.
 */
export const REPORT_DISCLAIMER = "This package is informational only. Consult a legal professional before deployment.";

/**
 * Longer-form disclaimer for UI surfaces that have room for it. Complements,
 * but never replaces, REPORT_DISCLAIMER.
 */
export const DISCLAIMER_LONG =
  "Comply-Quick provides automated operational templates based on technical configuration inputs. " +
  "Comply-Quick is not a law firm, does not provide formal legal counsel, and the outputs generated do not constitute legal advice.";

/**
 * Liability cap clause surfaced in the Terms of Service. Client assumes all
 * legal risk arising from use of generated content.
 */
export const LIABILITY_CAP =
  "We are not liable for damages from use of generated content. Client assumes all legal risk.";

/** Terms version + effective date. Bump when the terms materially change. */
export const TERMS_VERSION = LEGAL_VERSION;
export const TERMS_EFFECTIVE_DATE = LEGAL_EFFECTIVE_DATE;
export { COMPANY_LEGAL_NAME, COMPANY_TRADE_NAME, GOVERNING_LAW_CLAUSE, LEGAL_VERSION, SUPPORT_EMAIL, VENUE_CLAUSE };

export interface TermsSection {
  heading: string;
  body: string[];
}

/**
 * Terms of Service content, rendered by /legal/terms. The liability-cap section
 * embeds LIABILITY_CAP verbatim so the page and any contractual reference stay
 * in sync.
 */
export const TERMS_OF_SERVICE: TermsSection[] = [
  {
    heading: "1. Nature of the Service",
    body: [
      `${COMPANY_TRADE_NAME} is a software-as-a-service platform operated by ${COMPANY_LEGAL_NAME}. It generates compliance templates, privacy policies, operational checklists, monitoring signals, and related workflow tools from the technical and jurisdictional inputs you provide.`,
      `${COMPANY_TRADE_NAME} is not a law firm and does not provide formal legal counsel. Generated content is informational only, is not legal advice, and must be reviewed by a qualified legal professional before reliance or deployment.`,
    ],
  },
  {
    heading: "2. No Attorney-Client Relationship",
    body: [
      `Using ${COMPANY_TRADE_NAME} does not create an attorney-client relationship. No communication with ${COMPANY_TRADE_NAME} or its systems is privileged or confidential in the legal sense.`,
    ],
  },
  {
    heading: "3. Eligibility and Accounts",
    body: [
      "You must be legally capable of entering a binding agreement and must provide accurate account and billing information.",
      "You are responsible for safeguarding credentials, activity under your account, and promptly reporting suspected compromise to the support address below.",
    ],
  },
  {
    heading: "4. Acceptable Use",
    body: [
      "You may use the service only for lawful business and compliance operations. You must not misuse the service, evade security controls, upload malicious code, infringe rights, or process data you are not authorized to process.",
      "The Acceptable Use Policy at /legal/acceptable-use is incorporated into these Terms.",
    ],
  },
  {
    heading: "5. Subscriptions, Billing, and Cancellation",
    body: [
      "Paid subscriptions renew automatically for the selected billing period unless canceled before renewal. Charges, taxes, trials, guarantees, and refunds are described in the Subscription and Cancellation Policy.",
      "The Subscription and Cancellation Policy at /legal/subscription is incorporated into these Terms.",
    ],
  },
  {
    heading: "6. Intellectual Property and License",
    body: [
      `${COMPANY_TRADE_NAME} and its licensors retain all rights in the service, software, interfaces, documentation, branding, and underlying technology. Except for the limited right to use the service during your subscription, no rights are transferred.`,
      "Subject to these Terms, you grant us a limited license to process submitted content solely to provide, secure, maintain, and improve the service. You retain ownership of your content and are responsible for obtaining all required permissions.",
    ],
  },
  {
    heading: "7. Customer Data and Feedback",
    body: [
      "You are responsible for the legality, accuracy, and completeness of customer data and other content submitted to the service. You represent that you have the rights and notices required for us to process it as described in these Terms and the Privacy Policy.",
      "You may provide suggestions or feedback. We may use feedback without restriction or payment, provided we do not identify you publicly as its source without permission.",
    ],
  },
  {
    heading: "8. Third-Party Services",
    body: [
      "The service may interoperate with third-party products, including hosting, authentication, payments, artificial-intelligence, monitoring, and communications providers. Their terms and privacy practices may apply to those integrations.",
      "We do not control and are not responsible for third-party services, outages, content, or changes, except as required by applicable law.",
    ],
  },
  {
    heading: "9. Disclaimers",
    body: [
      "THE SERVICE AND ALL GENERATED CONTENT ARE PROVIDED ON AN “AS IS” AND “AS AVAILABLE” BASIS TO THE MAXIMUM EXTENT PERMITTED BY LAW.",
      "We disclaim implied warranties, including merchantability, fitness for a particular purpose, title, non-infringement, accuracy, and uninterrupted or error-free operation. No output guarantees compliance, legal sufficiency, or a particular regulatory result.",
    ],
  },
  {
    heading: "10. Limitation of Liability",
    body: [
      LIABILITY_CAP,
      `To the maximum extent permitted by law, ${COMPANY_TRADE_NAME}'s total aggregate liability for any claim arising out of or related to the service is limited to the amount you paid to ${COMPANY_TRADE_NAME} in the twelve (12) months preceding the event giving rise to the claim.`,
      `${COMPANY_TRADE_NAME} is not liable for indirect, incidental, consequential, special, exemplary, or punitive damages, including lost profits, regulatory fines, or legal costs, arising from use of the service or generated content.`,
    ],
  },
  {
    heading: "11. Indemnification",
    body: [
      `You will defend, indemnify, and hold harmless ${COMPANY_LEGAL_NAME} and its officers, employees, and contractors from third-party claims, losses, liabilities, and reasonable expenses arising from your content, misuse of the service, violation of these Terms, or violation of law or another person's rights.`,
    ],
  },
  {
    heading: "12. Term and Termination",
    body: [
      "These Terms begin when you accept them or use the service and continue until your account is terminated. You may stop using the service at any time; cancellation does not waive amounts already owed.",
      "We may suspend or terminate access for material breach, legal risk, security threats, nonpayment, or operational necessity. Provisions that by their nature should survive termination will survive.",
    ],
  },
  {
    heading: "13. Governing Law, Arbitration, and Venue",
    body: [
      GOVERNING_LAW_CLAUSE,
      "Except for eligible small-claims matters or requests for injunctive relief concerning intellectual property, confidentiality, or security, disputes must be resolved by binding individual arbitration administered by the American Arbitration Association under its applicable commercial rules.",
      "You and Comply-Quick waive trial by jury and participation in any class, collective, representative, or private-attorney-general action to the fullest extent permitted by law. Arbitration must be individual and may not be consolidated with another proceeding without written consent.",
      VENUE_CLAUSE,
    ],
  },
  {
    heading: "14. Changes, Force Majeure, and Entire Agreement",
    body: [
      "We may update these Terms by posting a revised version and changing the effective date. Material changes will be communicated through the service or account contact where reasonably practicable. Continued use after the effective date constitutes acceptance.",
      "Neither party is responsible for delay or failure caused by events beyond reasonable control, including natural disasters, war, labor disputes, internet failures, or governmental action.",
      "These Terms, incorporated policies, and applicable order forms are the entire agreement about the service and replace prior understandings. If a provision is unenforceable, it will be narrowed to the minimum extent necessary and the remainder will remain effective.",
    ],
  },
  {
    heading: "15. Contact",
    body: [
      `Questions about these Terms may be sent to ${SUPPORT_EMAIL}. ${COMPANY_LEGAL_NAME} is the service provider identified in these Terms.`,
    ],
  },
];
