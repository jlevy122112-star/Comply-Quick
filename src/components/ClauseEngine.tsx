/**
 * ClauseEngine.tsx
 * Core backend logic engine — conditional evaluation matrix mapping
 * developer stacks to protective legal text.
 */

// ─── Type Definitions ────────────────────────────────────────────────────────

export type UserType = "developer" | "merchant";

export type Framework = "shopify" | "nextjs" | "wordpress";

export type TrackingPixel = "meta" | "google" | "tiktok";

export type TargetRegion =
  | "us_general"
  | "california_ccpa"
  | "eu_gdpr";

export interface ComplianceInput {
  userType: UserType;
  framework: Framework;
  trackingPixels: TrackingPixel[];
  targetRegions: TargetRegion[];
}

export interface ContractShieldClause {
  title: string;
  body: string;
}

export interface InwardContractShield {
  preamble: string;
  clauses: ContractShieldClause[];
}

export interface PrivacyPolicyAddendum {
  header: string;
  scriptDeclarations: string[];
  regionalDisclosures: string[];
}

export interface ChecklistItem {
  step: number;
  action: string;
  critical: boolean;
}

export interface DeveloperPreLaunchChecklist {
  frameworkNotes: string;
  items: ChecklistItem[];
}

export interface CompliancePackage {
  inwardContractShield: InwardContractShield;
  consumerPrivacyPolicyAddendum: PrivacyPolicyAddendum;
  developerPreLaunchChecklist: DeveloperPreLaunchChecklist;
}

// ─── Legal Boilerplate Text Blocks ──────────────────────────────────────────

const LIABILITY_SHIFT_PREAMBLES: Record<UserType, string> = {
  developer:
    "This Inward Contract Shield Agreement (\"Agreement\") is entered into between the Web Developer (\"Developer\") and the Store Merchant (\"Merchant\"). The Developer provides technical implementation services only. The Merchant retains full legal responsibility for all compliance obligations, data collection practices, and consumer-facing legal disclosures. The Developer expressly disclaims all liability arising from the Merchant's failure to maintain compliant data practices post-deployment.",
  merchant:
    "This Inward Contract Shield Agreement (\"Agreement\") is entered into between the Store Merchant (\"Merchant\") and the Web Developer (\"Developer\"). The Merchant acknowledges sole responsibility for ongoing compliance maintenance, legal disclosure accuracy, and consumer data handling practices. The Developer's obligation is limited to technical implementation as specified in the project scope.",
};

const FRAMEWORK_LIABILITY_CLAUSES: Record<Framework, ContractShieldClause[]> = {
  shopify: [
    {
      title: "Platform Dependency Disclaimer",
      body: "Developer's implementation operates within the constraints of the Shopify platform. Any limitations imposed by Shopify's infrastructure, API restrictions, theme architecture, or app ecosystem that affect compliance posture are outside the Developer's control. Merchant acknowledges that Shopify platform updates, policy changes, or third-party app modifications may impact compliance status without Developer intervention.",
    },
    {
      title: "Third-Party App Liability Exclusion",
      body: "Merchant is solely responsible for vetting, installing, and maintaining all third-party Shopify apps. Any data collection, tracking, or processing conducted by third-party apps installed after Developer handoff is exclusively the Merchant's liability. Developer bears no responsibility for compliance violations introduced by apps not specified in the original project scope.",
    },
    {
      title: "Checkout & Payment Processing Exclusion",
      body: "Shopify's checkout process, payment gateways, and associated data handling are governed by Shopify's own terms of service and PCI compliance. Developer disclaims liability for any data processing that occurs within Shopify's managed checkout flow.",
    },
  ],
  nextjs: [
    {
      title: "Custom Implementation Scope Limitation",
      body: "Developer's implementation utilizes the Next.js framework for custom application development. The Developer's liability is strictly limited to code authored and deployed as part of the defined project scope. Any subsequent modifications, deployments, or infrastructure changes made by Merchant or third parties void Developer's compliance guarantees.",
    },
    {
      title: "Server-Side Rendering Data Handling",
      body: "Applications built with Next.js may process user data on both server and client environments. Merchant acknowledges responsibility for ensuring that all server-side data processing, API routes, and server components comply with applicable data protection regulations. Developer implements technical safeguards as specified but does not guarantee regulatory compliance of Merchant's business logic.",
    },
    {
      title: "Deployment Environment Responsibility",
      body: "Merchant is solely responsible for the security, configuration, and compliance of the production deployment environment (including but not limited to Vercel, AWS, or self-hosted infrastructure). Developer's responsibility terminates at code handoff unless an ongoing maintenance agreement is separately executed.",
    },
  ],
  wordpress: [
    {
      title: "Plugin Ecosystem Liability Exclusion",
      body: "WordPress operates within an open-source plugin ecosystem. Developer disclaims all liability for compliance violations introduced by plugins, themes, or core updates not explicitly managed under the project scope. Merchant assumes full responsibility for plugin maintenance, updates, and compatibility monitoring.",
    },
    {
      title: "Shared Hosting Environment Disclaimer",
      body: "Merchant's choice of hosting provider, server configuration, and infrastructure management directly impacts data security and compliance posture. Developer bears no liability for data breaches, unauthorized access, or compliance failures attributable to hosting environment deficiencies.",
    },
    {
      title: "Content Management Responsibility",
      body: "WordPress content, including pages, posts, forms, and media, is managed exclusively by the Merchant post-handoff. Developer disclaims liability for any non-compliant content, misleading disclosures, or unauthorized data collection implemented through WordPress's content management interface.",
    },
  ],
};

const PIXEL_SCRIPT_DECLARATIONS: Record<TrackingPixel, string> = {
  meta: "This website utilizes Meta (Facebook) Pixel tracking technology (fbevents.js). Meta Pixel collects data including: page views, content interactions, add-to-cart events, purchase completions, search queries, and form submissions. Data is transmitted to Meta Platforms, Inc. and may be used for advertising optimization, audience building, conversion tracking, and cross-platform user profiling. Users may opt out via Meta's Ad Preferences or by disabling cookies in their browser settings.",
  google:
    "This website implements Google Analytics (gtag.js/analytics.js) and/or Google Ads conversion tracking. Google's tracking technologies collect data including: session duration, page navigation paths, device information, geographic location (approximate), referral sources, and conversion events. Data is transmitted to Google LLC and may be used for advertising optimization, remarketing audiences, and aggregate analytics. Users may opt out via Google's Ads Settings or by installing the Google Analytics Opt-out Browser Add-on.",
  tiktok:
    "This website deploys TikTok Pixel tracking technology. TikTok Pixel collects data including: page views, button clicks, form submissions, purchase events, and content engagement metrics. Data is transmitted to ByteDance Ltd. (TikTok) and may be used for advertising optimization, custom audience creation, and campaign performance measurement. Users may opt out via TikTok's privacy settings or by adjusting cookie preferences on this website.",
};

const REGIONAL_DISCLOSURES: Record<TargetRegion, string> = {
  us_general:
    "United States General Disclosure: This website collects personal information as described in our Privacy Policy. We may share information with third-party service providers for business purposes including analytics, advertising, and site functionality. You may contact us to request information about our data practices. We implement commercially reasonable security measures to protect your personal information from unauthorized access, disclosure, or destruction.",
  california_ccpa:
    "California Consumer Privacy Act (CCPA/CPRA) Notice: If you are a California resident, you have the right to: (1) know what personal information is collected, used, shared, or sold; (2) delete personal information held by us and by extension our service providers; (3) opt-out of the sale or sharing of personal information; (4) non-discrimination for exercising your CCPA rights; and (5) correct inaccurate personal information. To exercise these rights, contact us using the information provided below. We will verify your identity before processing your request. Categories of personal information collected include: identifiers, internet activity, geolocation data, and commercial information. We do not knowingly sell the personal information of consumers under 16 years of age.",
  eu_gdpr:
    "General Data Protection Regulation (GDPR) Notice: For users in the European Economic Area (EEA), United Kingdom, and Switzerland: We process personal data under the following legal bases: (a) consent — where you have given explicit consent for specific processing purposes; (b) contract performance — where processing is necessary to fulfill our obligations; (c) legitimate interests — where processing serves our legitimate business interests without overriding your rights. You have the right to: access your data, rectify inaccuracies, erase your data (\"right to be forgotten\"), restrict processing, data portability, object to processing, and withdraw consent at any time. To exercise these rights or lodge a complaint with your supervisory authority, contact our Data Protection Officer at the address provided. Data transfers outside the EEA are protected by Standard Contractual Clauses or adequacy decisions.",
};

// ─── Checklist Generation ───────────────────────────────────────────────────

function buildChecklist(
  framework: Framework,
  trackingPixels: TrackingPixel[],
  targetRegions: TargetRegion[]
): DeveloperPreLaunchChecklist {
  const frameworkNotes = getFrameworkNotes(framework);
  const items: ChecklistItem[] = [];
  let step = 1;

  // Framework-specific checks
  const frameworkChecks = getFrameworkChecks(framework);
  for (const action of frameworkChecks) {
    items.push({ step, action, critical: true });
    step++;
  }

  // Pixel-specific checks
  for (const pixel of trackingPixels) {
    const pixelChecks = getPixelChecks(pixel);
    for (const action of pixelChecks) {
      items.push({ step, action, critical: true });
      step++;
    }
  }

  // Region-specific checks
  for (const region of targetRegions) {
    const regionChecks = getRegionChecks(region);
    for (const action of regionChecks) {
      items.push({ step, action, critical: true });
      step++;
    }
  }

  // Universal pre-launch checks
  const universalChecks = [
    "Run full accessibility audit (WCAG 2.1 AA minimum) on all consent interfaces",
    "Verify all privacy policy links resolve correctly and display current content",
    "Test cookie consent banner functionality across Chrome, Firefox, Safari, and Edge",
    "Confirm opt-out mechanisms function correctly and persist across sessions",
    "Document all data flows in a written data processing inventory",
    "Obtain written merchant sign-off on final compliance package before deployment",
  ];
  for (const action of universalChecks) {
    items.push({ step, action, critical: false });
    step++;
  }

  return { frameworkNotes, items };
}

function getFrameworkNotes(framework: Framework): string {
  switch (framework) {
    case "shopify":
      return "Shopify deployment: Ensure all scripts are loaded via Shopify's ScriptTag API or theme.liquid. Verify consent mechanisms work within Shopify's checkout restrictions. Test across multiple Shopify themes if theme-switching is possible.";
    case "nextjs":
      return "Next.js deployment: Verify server-side rendering does not execute tracking scripts before consent. Ensure client-side hydration respects consent state. Test API routes for proper data handling headers. Confirm middleware does not leak user data in server logs.";
    case "wordpress":
      return "WordPress deployment: Verify all tracking scripts load via wp_enqueue_script or a compliant tag manager plugin. Confirm no plugins inject unauthorized tracking. Test consent mechanisms with caching plugins enabled (WP Super Cache, W3 Total Cache). Validate that consent state persists through WordPress's page caching layer.";
  }
}

function getFrameworkChecks(framework: Framework): string[] {
  switch (framework) {
    case "shopify":
      return [
        "Verify Shopify Customer Privacy API integration for consent signals",
        "Confirm theme.liquid includes consent banner before any tracking script tags",
        "Test that checkout extensibility respects consent preferences",
        "Validate Shopify app proxy routes do not bypass consent mechanisms",
      ];
    case "nextjs":
      return [
        "Audit all pages using 'use client' directive for tracking script injection points",
        "Verify next/script components use strategy='lazyOnload' with consent gates",
        "Confirm API route handlers include appropriate CORS and privacy headers",
        "Test that server components do not serialize sensitive user data to client payload",
      ];
    case "wordpress":
      return [
        "Audit all active plugins for hidden tracking or data collection behaviors",
        "Verify wp_enqueue_script dependencies load in correct consent-gated order",
        "Confirm REST API endpoints require authentication for personal data access",
        "Test that caching plugins serve correct consent state (no stale consent banners)",
      ];
  }
}

function getPixelChecks(pixel: TrackingPixel): string[] {
  switch (pixel) {
    case "meta":
      return [
        "Verify Meta Pixel fires only after explicit user consent is granted",
        "Confirm Meta Conversions API server-side events include consent parameters",
        "Test Meta Pixel 'revoke' event fires correctly when user withdraws consent",
        "Validate that Meta Advanced Matching does not transmit PII without consent",
      ];
    case "google":
      return [
        "Verify Google Analytics consent mode (gtag 'consent' command) is properly configured",
        "Confirm Google Ads conversion tags respect consent state before firing",
        "Test that Google's cookieless pings (consent mode v2) function when consent is denied",
        "Validate Google Tag Manager container loads conditionally based on consent category",
      ];
    case "tiktok":
      return [
        "Verify TikTok Pixel initializes only after user consent is obtained",
        "Confirm TikTok Events API server-side integration respects consent withdrawal",
        "Test that TikTok's Limited Data Use flag is set for applicable jurisdictions",
        "Validate no TikTok cookies are dropped before consent banner interaction",
      ];
  }
}

function getRegionChecks(region: TargetRegion): string[] {
  switch (region) {
    case "us_general":
      return [
        "Verify privacy policy is accessible from every page via footer link",
        "Confirm contact information for privacy inquiries is clearly displayed",
        "Test that data collection disclosures accurately reflect all active scripts",
      ];
    case "california_ccpa":
      return [
        "Verify 'Do Not Sell or Share My Personal Information' link is present in site footer",
        "Confirm opt-out mechanism transmits Global Privacy Control (GPC) signals",
        "Test CCPA data deletion request workflow end-to-end",
        "Validate that financial incentive programs (if any) include required CCPA notices",
        "Confirm minors' data handling complies with CCPA Section 1798.120(c)",
      ];
    case "eu_gdpr":
      return [
        "Verify cookie consent banner meets GDPR requirements (no pre-checked boxes, clear accept/reject)",
        "Confirm Data Processing Agreement (DPA) is signed with all third-party processors",
        "Test data subject access request (DSAR) fulfillment workflow end-to-end",
        "Validate cross-border data transfer mechanisms (SCCs or adequacy) are documented",
        "Confirm legitimate interest assessments (LIAs) are completed for non-consent processing",
        "Verify consent records are stored with timestamp, scope, and method of collection",
      ];
  }
}

// ─── Main Export ────────────────────────────────────────────────────────────

const VALID_USER_TYPES: ReadonlySet<string> = new Set(["developer", "merchant"]);
const VALID_FRAMEWORKS: ReadonlySet<string> = new Set(["shopify", "nextjs", "wordpress"]);
const VALID_PIXELS: ReadonlySet<string> = new Set(["meta", "google", "tiktok"]);
const VALID_REGIONS: ReadonlySet<string> = new Set(["us_general", "california_ccpa", "eu_gdpr"]);

function validateInput(input: ComplianceInput): void {
  if (!VALID_USER_TYPES.has(input.userType)) {
    throw new Error(`Invalid userType: "${input.userType}". Must be "developer" or "merchant".`);
  }
  if (!VALID_FRAMEWORKS.has(input.framework)) {
    throw new Error(`Invalid framework: "${input.framework}". Must be "shopify", "nextjs", or "wordpress".`);
  }
  for (const pixel of input.trackingPixels) {
    if (!VALID_PIXELS.has(pixel)) {
      throw new Error(`Invalid tracking pixel: "${pixel}". Must be "meta", "google", or "tiktok".`);
    }
  }
  for (const region of input.targetRegions) {
    if (!VALID_REGIONS.has(region)) {
      throw new Error(`Invalid target region: "${region}". Must be "us_general", "california_ccpa", or "eu_gdpr".`);
    }
  }
}

export function generateCompliancePackage(
  input: ComplianceInput
): CompliancePackage {
  validateInput(input);
  const { userType, framework, trackingPixels, targetRegions } = input;

  // 1. Build Inward Contract Shield
  const inwardContractShield: InwardContractShield = {
    preamble: LIABILITY_SHIFT_PREAMBLES[userType],
    clauses: FRAMEWORK_LIABILITY_CLAUSES[framework],
  };

  // 2. Build Consumer-Facing Privacy Policy Addendum
  const scriptDeclarations = trackingPixels.map(
    (pixel) => PIXEL_SCRIPT_DECLARATIONS[pixel]
  );
  const regionalDisclosures = targetRegions.map(
    (region) => REGIONAL_DISCLOSURES[region]
  );

  const consumerPrivacyPolicyAddendum: PrivacyPolicyAddendum = {
    header: buildPrivacyHeader(framework, trackingPixels),
    scriptDeclarations,
    regionalDisclosures,
  };

  // 3. Build Developer Pre-Launch Checklist
  const developerPreLaunchChecklist = buildChecklist(
    framework,
    trackingPixels,
    targetRegions
  );

  return {
    inwardContractShield,
    consumerPrivacyPolicyAddendum,
    developerPreLaunchChecklist,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildPrivacyHeader(
  framework: Framework,
  pixels: TrackingPixel[]
): string {
  const frameworkLabel = getFrameworkLabel(framework);
  const pixelLabels = pixels.map(getPixelLabel).join(", ");

  const techDisclosure = pixelLabels
    ? `It provides specific disclosures regarding third-party tracking technologies actively deployed on this website: ${pixelLabels}.`
    : "No third-party tracking technologies have been declared for this website.";

  return `Privacy Policy Addendum — Technology Disclosure\n\nThis addendum supplements the primary Privacy Policy for this ${frameworkLabel} application. ${techDisclosure} This addendum was last updated on the date of deployment and must be reviewed whenever tracking configurations change.`;
}

function getFrameworkLabel(framework: Framework): string {
  switch (framework) {
    case "shopify":
      return "Shopify-powered e-commerce";
    case "nextjs":
      return "Next.js web";
    case "wordpress":
      return "WordPress-based";
  }
}

function getPixelLabel(pixel: TrackingPixel): string {
  switch (pixel) {
    case "meta":
      return "Meta (Facebook) Pixel";
    case "google":
      return "Google Analytics / Google Ads";
    case "tiktok":
      return "TikTok Pixel";
  }
}
