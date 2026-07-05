/**
 * ClauseEngine.tsx
 * Core backend logic engine — conditional evaluation matrix mapping
 * developer stacks to protective legal text.
 */

import { generateModuleOutputs, type ComplianceModule, type ComplianceModuleOutput } from "./EnterpriseModules";
import { REPORT_DISCLAIMER, DISCLAIMER_LONG } from "@/lib/legal";

export type { ComplianceModule, ComplianceModuleOutput };

// ─── Type Definitions ────────────────────────────────────────────────────────

export type UserType = "developer" | "merchant";

export type Framework =
  "shopify" | "nextjs" | "wordpress" | "wix" | "squarespace" | "godaddy" | "webflow" | "woocommerce" | "bigcommerce";

export type TrackingPixel = "meta" | "google" | "tiktok" | "linkedin" | "pinterest" | "snapchat";

export type TargetRegion =
  "us_general" | "california_ccpa" | "eu_gdpr" | "canada_pipeda" | "brazil_lgpd" | "australia_privacy";

export interface ComplianceInput {
  userType: UserType;
  framework: Framework;
  trackingPixels: TrackingPixel[];
  targetRegions: TargetRegion[];
  complianceModules?: ComplianceModule[];
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

export interface ComplianceScore {
  overall: number;
  contractProtection: number;
  privacyCoverage: number;
  preLaunchReadiness: number;
  regulatoryBreadth: number;
}

export interface CompliancePackage {
  inwardContractShield: InwardContractShield;
  consumerPrivacyPolicyAddendum: PrivacyPolicyAddendum;
  developerPreLaunchChecklist: DeveloperPreLaunchChecklist;
  enterpriseModules?: ComplianceModuleOutput[];
  complianceScore: ComplianceScore;
}

// ─── Legal Boilerplate Text Blocks ──────────────────────────────────────────

const LIABILITY_SHIFT_PREAMBLES: Record<UserType, string> = {
  developer:
    'This Inward Contract Shield Agreement ("Agreement") is entered into between the Web Developer ("Developer") and the Store Merchant ("Merchant"). The Developer provides technical implementation services only. The Merchant retains full legal responsibility for all compliance obligations, data collection practices, and consumer-facing legal disclosures. The Developer expressly disclaims all liability arising from the Merchant\'s failure to maintain compliant data practices post-deployment.',
  merchant:
    'This Inward Contract Shield Agreement ("Agreement") is entered into between the Store Merchant ("Merchant") and the Web Developer ("Developer"). The Merchant acknowledges sole responsibility for ongoing compliance maintenance, legal disclosure accuracy, and consumer data handling practices. The Developer\'s obligation is limited to technical implementation as specified in the project scope.',
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
  wix: [
    {
      title: "Closed Platform Architecture Disclaimer",
      body: "Wix operates as a closed, proprietary platform with limited code-level access. Developer's implementation is constrained by Wix's built-in components, Velo (formerly Corvid) API limitations, and platform-imposed restrictions. Merchant acknowledges that Wix platform updates, feature deprecations, or infrastructure changes may impact compliance posture without Developer intervention or ability to remediate.",
    },
    {
      title: "Wix App Market Liability Exclusion",
      body: "Third-party applications installed via the Wix App Market operate under their own data processing terms. Developer disclaims all liability for data collection, storage, or transmission practices of Wix App Market applications not explicitly specified in the project scope. Merchant is solely responsible for reviewing and accepting the privacy terms of each installed application.",
    },
    {
      title: "Managed Infrastructure Limitation",
      body: "Wix manages all hosting infrastructure, SSL certificates, CDN distribution, and server-side processing. Developer has no access to server configurations, log files, or infrastructure-level security controls. Any security incidents, data breaches, or compliance failures arising from Wix's managed infrastructure are governed exclusively by Wix's Terms of Service and Data Processing Addendum.",
    },
  ],
  squarespace: [
    {
      title: "Template-Based Architecture Disclaimer",
      body: "Squarespace implementations operate within the constraints of Squarespace's template system and built-in content management tools. Developer's customizations are limited to CSS overrides, code injection blocks, and Squarespace's developer API. Merchant acknowledges that Squarespace platform updates may override custom implementations without notice, potentially affecting compliance configurations.",
    },
    {
      title: "Integrated Commerce Liability Exclusion",
      body: "Squarespace Commerce features, including checkout, payment processing, tax calculation, and shipping, are fully managed by Squarespace. Developer disclaims liability for data handling practices within Squarespace's integrated commerce pipeline. Merchant is responsible for configuring Squarespace Commerce settings in compliance with applicable regulations.",
    },
    {
      title: "Third-Party Integration Responsibility",
      body: "Squarespace integrations with third-party services (email marketing, analytics, social media) are configured through Squarespace's built-in integration panel. Developer disclaims liability for data sharing that occurs through Merchant-configured integrations not specified in the original project scope. Each integration's data practices are governed by the respective third party's privacy policy.",
    },
  ],
  godaddy: [
    {
      title: "Managed Builder Platform Disclaimer",
      body: "GoDaddy Website Builder is a closed, template-driven managed platform. Developer's customizations are limited to the sections, widgets, and HTML/embed blocks GoDaddy exposes. Merchant acknowledges that GoDaddy platform updates, plan changes, or feature deprecations may alter compliance posture at any time without Developer control or ability to remediate.",
    },
    {
      title: "Bundled Marketing & Analytics Exclusion",
      body: "GoDaddy bundles native tools including InSight analytics, GoDaddy Conversations, and email/SMS marketing that collect visitor and customer data under GoDaddy's own terms. Developer disclaims all liability for data collected, stored, or transmitted by GoDaddy-native marketing and analytics features enabled or configured by the Merchant.",
    },
    {
      title: "Managed Hosting & Domain Responsibility",
      body: "GoDaddy manages all hosting, SSL, DNS, and email infrastructure, and Developer has no server-level access. Any data breach, misconfiguration, or compliance failure originating in GoDaddy's managed infrastructure or the Merchant's account, domain, or DNS settings is exclusively the Merchant's responsibility.",
    },
  ],
  webflow: [
    {
      title: "Visual Builder Scope Limitation",
      body: "Developer's implementation is authored within the Webflow Designer and is constrained by Webflow's element model, interaction system, and custom-code embed limits. Any modifications made by the Merchant in the Webflow Editor or Designer after handoff void Developer's compliance guarantees for the affected pages.",
    },
    {
      title: "Custom Code Embed Liability Exclusion",
      body: "Third-party scripts added through Webflow custom code embeds, site-wide head/body code, or native integrations (analytics, chat, forms, marketing) after handoff are the Merchant's responsibility. Developer disclaims liability for any data collection introduced by embeds or integrations not specified in the original project scope.",
    },
    {
      title: "Webflow Hosting & Forms Data Handling",
      body: "Webflow manages hosting, CDN, SSL, and native Form submission storage. Developer disclaims liability for data processing that occurs within Webflow's managed infrastructure and Form data pipeline, which is governed by Webflow's Terms of Service and Data Processing Addendum.",
    },
  ],
  woocommerce: [
    {
      title: "Plugin & Extension Ecosystem Exclusion",
      body: "WooCommerce operates atop WordPress within an open extension ecosystem. Developer disclaims all liability for compliance violations introduced by WooCommerce extensions, payment gateways, or WordPress plugins and themes not explicitly managed under the project scope. Merchant assumes full responsibility for extension maintenance, updates, and compatibility monitoring.",
    },
    {
      title: "Payment Gateway & Checkout Exclusion",
      body: "WooCommerce checkout integrates third-party payment gateways (including Stripe, PayPal, and WooPayments) governed by their own PCI-DSS and data-processing terms. Developer disclaims liability for cardholder data handling that occurs within gateway-hosted or gateway-managed checkout flows.",
    },
    {
      title: "Customer Data & Order Storage Responsibility",
      body: "WooCommerce stores customer, order, and account data in the Merchant's WordPress database on Merchant-controlled hosting. Developer bears no liability for data breaches, retention failures, or unauthorized access attributable to the Merchant's hosting environment, database security, or store configuration after handoff.",
    },
  ],
  bigcommerce: [
    {
      title: "SaaS Platform Dependency Disclaimer",
      body: "BigCommerce is a hosted SaaS commerce platform. Developer's implementation is constrained by BigCommerce's Stencil theme framework, API rate limits, and available platform features. Merchant acknowledges that BigCommerce platform updates, API deprecations, or plan changes may affect compliance posture without Developer intervention.",
    },
    {
      title: "App Marketplace & Integration Exclusion",
      body: "Applications installed from the BigCommerce App Marketplace and third-party integrations operate under their own data-processing terms. Developer disclaims all liability for data collection, storage, or transmission by apps installed after handoff that are not specified in the original project scope.",
    },
    {
      title: "Managed Checkout & PCI Responsibility",
      body: "BigCommerce provides PCI-DSS-compliant hosted checkout and manages payment data flows. Developer disclaims liability for data handling within BigCommerce's managed checkout and for the Merchant's configuration of payment providers, tax, and shipping settings.",
    },
  ],
};

const PIXEL_SCRIPT_DECLARATIONS: Record<TrackingPixel, string> = {
  meta: "This website utilizes Meta (Facebook) Pixel tracking technology (fbevents.js). Meta Pixel collects data including: page views, content interactions, add-to-cart events, purchase completions, search queries, and form submissions. Data is transmitted to Meta Platforms, Inc. and may be used for advertising optimization, audience building, conversion tracking, and cross-platform user profiling. Users may opt out via Meta's Ad Preferences or by disabling cookies in their browser settings.",
  google:
    "This website implements Google Analytics (gtag.js/analytics.js) and/or Google Ads conversion tracking. Google's tracking technologies collect data including: session duration, page navigation paths, device information, geographic location (approximate), referral sources, and conversion events. Data is transmitted to Google LLC and may be used for advertising optimization, remarketing audiences, and aggregate analytics. Users may opt out via Google's Ads Settings or by installing the Google Analytics Opt-out Browser Add-on.",
  tiktok:
    "This website deploys TikTok Pixel tracking technology. TikTok Pixel collects data including: page views, button clicks, form submissions, purchase events, and content engagement metrics. Data is transmitted to ByteDance Ltd. (TikTok) and may be used for advertising optimization, custom audience creation, and campaign performance measurement. Users may opt out via TikTok's privacy settings or by adjusting cookie preferences on this website.",
  linkedin:
    "This website implements LinkedIn Insight Tag tracking technology. The LinkedIn Insight Tag collects data including: page views, URL metadata, referral URLs, device characteristics, IP addresses (anonymized), and LinkedIn member demographics (job title, industry, company size, seniority). Data is transmitted to LinkedIn Corporation (Microsoft) and may be used for conversion tracking, website retargeting, audience analytics, and matched audience advertising. Users may opt out via LinkedIn's Ad Settings or by disabling cookies in their browser.",
  pinterest:
    "This website utilizes Pinterest Tag tracking technology. The Pinterest Tag collects data including: page visits, product page views, add-to-cart events, checkout initiations, purchase completions, search queries, and custom event data. Data is transmitted to Pinterest, Inc. and may be used for conversion measurement, audience targeting, dynamic retargeting, and ad performance optimization. Users may opt out via Pinterest's Personalization Settings or by adjusting cookie preferences on this website.",
  snapchat:
    "This website deploys Snap Pixel tracking technology. The Snap Pixel collects data including: page views, form submissions, purchase events, add-to-cart actions, and content engagement signals. Data is transmitted to Snap Inc. and may be used for conversion tracking, custom audience creation, lookalike audience generation, and campaign optimization. Users may opt out via Snapchat's advertising preferences or by managing cookie settings on this website.",
};

const REGIONAL_DISCLOSURES: Record<TargetRegion, string> = {
  us_general:
    "United States General Disclosure: This website collects personal information as described in our Privacy Policy. We may share information with third-party service providers for business purposes including analytics, advertising, and site functionality. You may contact us to request information about our data practices. We implement commercially reasonable security measures to protect your personal information from unauthorized access, disclosure, or destruction.",
  california_ccpa:
    "California Consumer Privacy Act (CCPA/CPRA) Notice: If you are a California resident, you have the right to: (1) know what personal information is collected, used, shared, or sold; (2) delete personal information held by us and by extension our service providers; (3) opt-out of the sale or sharing of personal information; (4) non-discrimination for exercising your CCPA rights; and (5) correct inaccurate personal information. To exercise these rights, contact us using the information provided below. We will verify your identity before processing your request. Categories of personal information collected include: identifiers, internet activity, geolocation data, and commercial information. We do not knowingly sell the personal information of consumers under 16 years of age.",
  eu_gdpr:
    'General Data Protection Regulation (GDPR) Notice: For users in the European Economic Area (EEA), United Kingdom, and Switzerland: We process personal data under the following legal bases: (a) consent — where you have given explicit consent for specific processing purposes; (b) contract performance — where processing is necessary to fulfill our obligations; (c) legitimate interests — where processing serves our legitimate business interests without overriding your rights. You have the right to: access your data, rectify inaccuracies, erase your data ("right to be forgotten"), restrict processing, data portability, object to processing, and withdraw consent at any time. To exercise these rights or lodge a complaint with your supervisory authority, contact our Data Protection Officer at the address provided. Data transfers outside the EEA are protected by Standard Contractual Clauses or adequacy decisions.',
  canada_pipeda:
    "Personal Information Protection and Electronic Documents Act (PIPEDA) Notice: For users in Canada, we collect, use, and disclose personal information in accordance with PIPEDA and applicable provincial privacy legislation. You have the right to: (1) know what personal information we hold about you; (2) challenge the accuracy and completeness of your information; (3) request amendment of inaccurate information; (4) withdraw consent for the collection, use, or disclosure of your information (subject to legal and contractual restrictions). We obtain meaningful consent before collecting personal information and limit collection to purposes a reasonable person would consider appropriate. To submit an access request or privacy complaint, contact our Privacy Officer at the address provided. You also have the right to file a complaint with the Office of the Privacy Commissioner of Canada.",
  brazil_lgpd:
    "Lei Geral de Proteção de Dados (LGPD) Notice: For users in Brazil, we process personal data in compliance with Law No. 13,709/2018 (LGPD). Legal bases for processing include: consent, legitimate interest, contract performance, regulatory compliance, and exercise of rights in judicial or administrative proceedings. You have the right to: (1) confirmation of the existence of data processing; (2) access to your data; (3) correction of incomplete, inaccurate, or outdated data; (4) anonymization, blocking, or deletion of unnecessary or excessive data; (5) data portability; (6) deletion of data processed with your consent; (7) information about shared data recipients; (8) revocation of consent. To exercise these rights, contact our Data Protection Officer (Encarregado). Complaints may be filed with the Autoridade Nacional de Proteção de Dados (ANPD).",
  australia_privacy:
    "Australian Privacy Act (1988) Notice: For users in Australia, we handle personal information in accordance with the Australian Privacy Principles (APPs) under the Privacy Act 1988. We collect personal information only when reasonably necessary for our functions or activities. You have the right to: (1) know what personal information we hold about you; (2) request correction of inaccurate information; (3) complain about a breach of the APPs. We take reasonable steps to protect personal information from misuse, interference, loss, and unauthorized access. Cross-border disclosures of personal information are made only where the recipient is subject to a substantially similar privacy regime or with your consent. To make an access or correction request, or to lodge a complaint, contact our Privacy Officer. You may also complain to the Office of the Australian Information Commissioner (OAIC).",
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
    case "wix":
      return "Wix deployment: Verify all custom tracking is added via Wix's Marketing Integrations panel or Velo code. Confirm Wix's built-in cookie consent bar is enabled and configured for applicable jurisdictions. Test that Wix App Market applications respect consent preferences. Note that server-side access is limited — compliance monitoring relies on client-side implementations.";
    case "squarespace":
      return "Squarespace deployment: Verify all tracking scripts are added via Code Injection (Header/Footer) with proper consent gating. Confirm Squarespace's built-in cookie banner is enabled for applicable regions. Test that third-party integrations configured through Squarespace's integration panel respect consent state. Validate that custom CSS/JS injections do not introduce unauthorized data collection.";
    case "godaddy":
      return "GoDaddy deployment: Add tracking and consent scripts only through the site's available HTML/embed sections, as GoDaddy Website Builder offers limited code access. Install and configure a compliant cookie-consent solution — the builder has no built-in granular consent manager. Disclose GoDaddy InSight analytics and any bundled marketing tools. Server-side access is unavailable, so compliance relies entirely on client-side implementation.";
    case "webflow":
      return "Webflow deployment: Add tracking scripts via Project Settings > Custom Code or per-page code embeds, gated behind consent. Webflow has no built-in consent manager, so integrate a compliant CMP via custom code. Verify native Webflow Forms and interactions do not transmit data before consent. Test that client edits in the Webflow Editor do not remove consent gating.";
    case "woocommerce":
      return "WooCommerce deployment: Load tracking scripts via wp_enqueue_script or a consent-aware tag manager, never hardcoded in themes. Confirm the consent solution suppresses WooCommerce marketing/analytics extensions and payment gateway scripts until consent is granted. Verify order and customer data endpoints (REST API, /wp-json/wc) require authentication. Test that consent state persists through page and object caching.";
    case "bigcommerce":
      return "BigCommerce deployment: Register scripts through the Script Manager with the correct consent category and page location rather than editing Stencil templates directly. Enable BigCommerce's consent settings or integrate a CMP for GDPR/CCPA. Verify App Marketplace apps honor consent, and confirm no analytics or advertising scripts fire on the hosted checkout before consent.";
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
    case "wix":
      return [
        "Verify Wix Cookie Consent Banner is enabled and configured for target jurisdictions",
        "Confirm Velo (Corvid) custom code respects consent state via wix-window API",
        "Audit all Wix App Market applications for undeclared data collection",
        "Test that Wix Marketing Integrations panel reflects all active tracking technologies",
      ];
    case "squarespace":
      return [
        "Verify Squarespace Cookie Banner is enabled in Settings > Privacy",
        "Confirm Code Injection scripts include consent-gating logic before execution",
        "Audit all connected integrations in Settings > Connected Accounts for data sharing",
        "Test that Squarespace Analytics built-in tracking is disclosed in privacy policy",
      ];
    case "godaddy":
      return [
        "Verify a compliant cookie-consent banner is installed via GoDaddy's available embed/HTML sections",
        "Confirm GoDaddy InSight analytics and bundled marketing tools are disclosed in the privacy policy",
        "Audit all embedded third-party scripts for consent gating, given the builder's limited code access",
        "Test that consent preferences persist across GoDaddy Website Builder pages and sessions",
      ];
    case "webflow":
      return [
        "Verify a consent management platform is integrated via Project Settings > Custom Code before any tracking fires",
        "Confirm per-page and site-wide custom code embeds are consent-gated",
        "Audit native Webflow Forms and integrations for data transmission prior to consent",
        "Test that client edits in the Webflow Editor do not bypass or remove consent logic",
      ];
    case "woocommerce":
      return [
        "Verify WooCommerce marketing/analytics extensions load only after consent via a consent-aware tag manager",
        "Confirm payment gateway scripts (Stripe, PayPal, WooPayments) fire within PCI-compliant, consent-gated contexts",
        "Audit /wp-json/wc REST endpoints to ensure order and customer data require authentication",
        "Test that consent state persists through WordPress page and object caching layers",
      ];
    case "bigcommerce":
      return [
        "Verify tracking scripts are registered in BigCommerce Script Manager with the correct consent category",
        "Confirm no analytics or advertising scripts fire on the hosted checkout before consent",
        "Audit installed App Marketplace apps for undeclared data collection and consent compliance",
        "Test that BigCommerce consent/GDPR settings or the integrated CMP block cookies until opt-in",
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
    case "linkedin":
      return [
        "Verify LinkedIn Insight Tag fires only after explicit user consent is granted",
        "Confirm LinkedIn Conversions API respects consent state for server-side events",
        "Test that LinkedIn demographic data collection is disclosed in privacy policy",
        "Validate LinkedIn cookie (_li_ss, li_fat_id) is not set before consent",
      ];
    case "pinterest":
      return [
        "Verify Pinterest Tag initializes only after user consent is obtained",
        "Confirm Pinterest Enhanced Match does not transmit PII without consent",
        "Test that Pinterest conversion events respect consent withdrawal signals",
        "Validate Pinterest cookies are not dropped before consent banner interaction",
      ];
    case "snapchat":
      return [
        "Verify Snap Pixel fires only after explicit user consent is granted",
        "Confirm Snap Conversions API server-side events include consent parameters",
        "Test that Snap Pixel advanced matching respects consent preferences",
        "Validate no Snapchat cookies (_scid, _schn) are set before consent",
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
    case "canada_pipeda":
      return [
        "Verify meaningful consent is obtained before collecting personal information",
        "Confirm privacy policy is available in both English and French for Canadian users",
        "Test data access and correction request workflow end-to-end",
        "Validate that data retention periods are documented and enforced",
        "Confirm breach notification procedures comply with PIPEDA breach reporting requirements",
      ];
    case "brazil_lgpd":
      return [
        "Verify LGPD-compliant consent mechanism with granular purpose selection",
        "Confirm Data Protection Officer (Encarregado) contact information is publicly accessible",
        "Test data portability request fulfillment workflow end-to-end",
        "Validate legal basis documentation for each category of data processing",
        "Confirm data anonymization and deletion procedures are implemented and tested",
      ];
    case "australia_privacy":
      return [
        "Verify Australian Privacy Principles (APP) compliance for data collection notices",
        "Confirm cross-border disclosure recipients are subject to substantially similar privacy protections",
        "Test data access and correction request workflow end-to-end",
        "Validate that privacy policy clearly describes data handling in plain language",
        "Confirm breach notification procedures comply with Notifiable Data Breaches (NDB) scheme",
      ];
  }
}

// ─── Main Export ────────────────────────────────────────────────────────────

const VALID_USER_TYPES: ReadonlySet<string> = new Set(["developer", "merchant"]);
const VALID_FRAMEWORKS: ReadonlySet<string> = new Set([
  "shopify",
  "nextjs",
  "wordpress",
  "wix",
  "squarespace",
  "godaddy",
  "webflow",
  "woocommerce",
  "bigcommerce",
]);
const VALID_PIXELS: ReadonlySet<string> = new Set(["meta", "google", "tiktok", "linkedin", "pinterest", "snapchat"]);
const VALID_REGIONS: ReadonlySet<string> = new Set([
  "us_general",
  "california_ccpa",
  "eu_gdpr",
  "canada_pipeda",
  "brazil_lgpd",
  "australia_privacy",
]);

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

export function generateCompliancePackage(input: ComplianceInput): CompliancePackage {
  validateInput(input);
  const { userType, framework, trackingPixels, targetRegions, complianceModules } = input;

  // 1. Build Inward Contract Shield
  const inwardContractShield: InwardContractShield = {
    preamble: LIABILITY_SHIFT_PREAMBLES[userType],
    clauses: FRAMEWORK_LIABILITY_CLAUSES[framework],
  };

  // 2. Build Consumer-Facing Privacy Policy Addendum
  const scriptDeclarations = trackingPixels.map((pixel) => PIXEL_SCRIPT_DECLARATIONS[pixel]);
  const regionalDisclosures = targetRegions.map((region) => REGIONAL_DISCLOSURES[region]);

  const consumerPrivacyPolicyAddendum: PrivacyPolicyAddendum = {
    header: buildPrivacyHeader(framework, trackingPixels),
    scriptDeclarations,
    regionalDisclosures,
  };

  // 3. Build Developer Pre-Launch Checklist
  const developerPreLaunchChecklist = buildChecklist(framework, trackingPixels, targetRegions);

  // 4. Generate Enterprise Module Outputs (if provided)
  let enterpriseModules: ComplianceModuleOutput[] | undefined;
  if (complianceModules && complianceModules.length > 0) {
    enterpriseModules = generateModuleOutputs(complianceModules);
  }

  // 5. Calculate Compliance Score
  const complianceScore = calculateComplianceScore(
    inwardContractShield,
    trackingPixels,
    targetRegions,
    developerPreLaunchChecklist,
    complianceModules
  );

  return {
    inwardContractShield,
    consumerPrivacyPolicyAddendum,
    developerPreLaunchChecklist,
    enterpriseModules,
    complianceScore,
  };
}

// ─── Compliance Score Calculation ───────────────────────────────────────────

function calculateComplianceScore(
  shield: InwardContractShield,
  pixels: TrackingPixel[],
  regions: TargetRegion[],
  checklist: DeveloperPreLaunchChecklist,
  modules?: ComplianceModule[]
): ComplianceScore {
  // Contract Protection: based on clause coverage
  const maxClauses = 4;
  const clauseRatio = Math.min(shield.clauses.length / maxClauses, 1);
  const contractProtection = Math.round(70 + clauseRatio * 30);

  // Privacy Coverage: based on pixel declarations and disclosure depth
  const pixelScore = pixels.length > 0 ? Math.min(pixels.length / 3, 1) * 40 : 0;
  const basePrivacy = 50;
  const privacyCoverage = Math.round(Math.min(basePrivacy + pixelScore + (modules ? modules.length * 5 : 0), 100));

  // Pre-Launch Readiness: based on checklist comprehensiveness
  const criticalItems = checklist.items.filter((i) => i.critical).length;
  const totalItems = checklist.items.length;
  const readinessBase = 40;
  const criticalBonus = Math.min(criticalItems / 10, 1) * 35;
  const totalBonus = Math.min(totalItems / 20, 1) * 25;
  const preLaunchReadiness = Math.round(Math.min(readinessBase + criticalBonus + totalBonus, 100));

  // Regulatory Breadth: based on jurisdiction coverage + enterprise modules
  const regionScore = Math.min(regions.length / 3, 1) * 60;
  const moduleBonus = modules ? Math.min(modules.length / 4, 1) * 30 : 0;
  const regulatoryBreadth = Math.round(Math.min(10 + regionScore + moduleBonus, 100));

  // Overall: weighted average
  const overall = Math.round(
    contractProtection * 0.25 + privacyCoverage * 0.25 + preLaunchReadiness * 0.25 + regulatoryBreadth * 0.25
  );

  return {
    overall,
    contractProtection,
    privacyCoverage,
    preLaunchReadiness,
    regulatoryBreadth,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildPrivacyHeader(framework: Framework, pixels: TrackingPixel[]): string {
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
    case "wix":
      return "Wix-built";
    case "squarespace":
      return "Squarespace-powered";
    case "godaddy":
      return "GoDaddy Website Builder";
    case "webflow":
      return "Webflow-built";
    case "woocommerce":
      return "WooCommerce e-commerce";
    case "bigcommerce":
      return "BigCommerce e-commerce";
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
    case "linkedin":
      return "LinkedIn Insight Tag";
    case "pinterest":
      return "Pinterest Tag";
    case "snapchat":
      return "Snap Pixel";
  }
}

// ─── Markdown Export ────────────────────────────────────────────────────────

export function exportToMarkdown(pkg: CompliancePackage): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  lines.push("# Compliance Package Report");
  lines.push(`Generated by Comply-Quick on ${now}\n`);
  lines.push(`**Compliance Score: ${pkg.complianceScore.overall}/100**\n`);
  lines.push(`> ⚠️ ${REPORT_DISCLAIMER}\n`);
  lines.push("---\n");

  // Inward Contract Shield
  lines.push("## 1. Inward Contract Shield\n");
  lines.push(pkg.inwardContractShield.preamble);
  lines.push("");
  for (const clause of pkg.inwardContractShield.clauses) {
    lines.push(`### ${clause.title}\n`);
    lines.push(clause.body);
    lines.push("");
  }

  // Privacy Policy Addendum
  lines.push("---\n");
  lines.push("## 2. Consumer Privacy Policy Addendum\n");
  lines.push(pkg.consumerPrivacyPolicyAddendum.header);
  lines.push("");
  if (pkg.consumerPrivacyPolicyAddendum.scriptDeclarations.length > 0) {
    lines.push("### Script Declarations\n");
    for (const decl of pkg.consumerPrivacyPolicyAddendum.scriptDeclarations) {
      lines.push(`> ${decl}\n`);
    }
  }
  if (pkg.consumerPrivacyPolicyAddendum.regionalDisclosures.length > 0) {
    lines.push("### Regional Disclosures\n");
    for (const disc of pkg.consumerPrivacyPolicyAddendum.regionalDisclosures) {
      lines.push(`> ${disc}\n`);
    }
  }

  // Developer Pre-Launch Checklist
  lines.push("---\n");
  lines.push("## 3. Developer Pre-Launch Checklist\n");
  lines.push(`*${pkg.developerPreLaunchChecklist.frameworkNotes}*\n`);
  for (const item of pkg.developerPreLaunchChecklist.items) {
    const marker = item.critical ? "🔴" : "⚪";
    lines.push(`- [ ] ${marker} **Step ${item.step}:** ${item.action}`);
  }
  lines.push("");

  // Enterprise Modules
  if (pkg.enterpriseModules && pkg.enterpriseModules.length > 0) {
    lines.push("---\n");
    lines.push("## 4. Enterprise Compliance Modules\n");
    for (const mod of pkg.enterpriseModules) {
      lines.push(`### ${mod.moduleName}\n`);
      lines.push(mod.summary);
      lines.push("");
      for (const clause of mod.clauses) {
        lines.push(`#### ${clause.title}\n`);
        lines.push(clause.body);
        lines.push("");
      }
      lines.push("**Module Checklist:**\n");
      for (const item of mod.checklistItems) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push("");
    }
  }

  // Score Breakdown
  lines.push("---\n");
  lines.push("## Compliance Score Breakdown\n");
  lines.push(`| Category | Score |`);
  lines.push(`|---|---|`);
  lines.push(`| Contract Protection | ${pkg.complianceScore.contractProtection}/100 |`);
  lines.push(`| Privacy Coverage | ${pkg.complianceScore.privacyCoverage}/100 |`);
  lines.push(`| Pre-Launch Readiness | ${pkg.complianceScore.preLaunchReadiness}/100 |`);
  lines.push(`| Regulatory Breadth | ${pkg.complianceScore.regulatoryBreadth}/100 |`);
  lines.push(`| **Overall** | **${pkg.complianceScore.overall}/100** |`);
  lines.push("");

  // Disclaimer
  lines.push("---\n");
  lines.push(`**${REPORT_DISCLAIMER}**\n`);
  lines.push(`*${DISCLAIMER_LONG}*`);

  return lines.join("\n");
}
