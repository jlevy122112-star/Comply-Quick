// Cookie Policy generator.
//
// Produces a jurisdiction-aware cookie policy document (Markdown + HTML + plain
// text) whose disclosures are DERIVED from the selected regions and tracking
// pixels rather than hardcoded. It is the companion document to the Cookie
// Consent Banner: the banner collects consent, this policy discloses — in the
// detail regulators expect — which cookies/technologies run, who receives the
// data, why, and how a visitor can control or withdraw consent.
//
// Every vendor row reads from the canonical PIXEL_VENDORS dataset, so adding a
// pixel there flows through the banner, the subprocessor register, and this
// policy in lockstep. The policy version is derived deterministically from the
// disclosed content, so it changes whenever the disclosed cookies/regions
// change — enabling the banner's proof-of-consent ledger to record which policy
// version each visitor consented against.

import {
  PIXEL_VENDORS,
  REGION_RULES,
  governingConsentModel,
  requiresDoNotSell,
  type ConsentModel,
  type TargetRegion,
  type TrackingPixel,
  type VendorMeta,
} from "./data";

export interface CookiePolicyInput {
  companyName: string;
  /** Public site the policy governs, e.g. "https://acme.com". Optional. */
  websiteUrl?: string;
  /** Where the broader privacy policy lives. Defaults to "/privacy". */
  privacyPolicyUrl?: string;
  /** Address a visitor can use to exercise privacy rights. Optional. */
  contactEmail?: string;
  regions: TargetRegion[];
  pixels: TrackingPixel[];
  /** Effective date (ISO yyyy-mm-dd). Defaults to today (UTC). */
  effectiveDate?: string;
}

/** A single row in the cookie/technology disclosure table. */
export interface CookiePolicyVendorRow {
  vendor: string;
  company: string;
  category: VendorMeta["category"];
  purpose: string;
  dataCategories: string[];
  scriptHosts: string[];
  optOutUrl: string;
  privacyPolicyUrl: string;
}

/** A category-level disclosure (essential / functional / analytics / advertising). */
export interface CookiePolicyCategory {
  key: "essential" | "functional" | "analytics" | "advertising";
  name: string;
  description: string;
  /** Whether non-essential tracking of this category is gated on consent. */
  consentRequired: boolean;
  /** Vendors disclosed under this category (empty for essential). */
  vendors: string[];
}

export interface CookiePolicyResult {
  consentModel: ConsentModel;
  requiresDoNotSell: boolean;
  effectiveDate: string;
  /** Deterministic version string that changes when disclosures change. */
  policyVersion: string;
  categories: CookiePolicyCategory[];
  vendors: CookiePolicyVendorRow[];
  /** Region display names the policy is written for. */
  regionNames: string[];
  markdown: string;
  html: string;
  text: string;
}

const DEFAULT_PRIVACY_URL = "/privacy";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes characters that would break a Markdown table cell. */
function mdCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/**
 * Sanitizes a user-supplied URL so the rendered HTML policy can never carry an
 * executable scheme (e.g. `javascript:`/`data:`). Allows relative/anchor paths,
 * http(s), and mailto; anything else falls back to a safe relative path.
 */
function safeUrl(url: string | undefined, fallback: string): string {
  const value = (url ?? "").trim();
  if (!value) return fallback;
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("./") || value.startsWith("../")) {
    return value;
  }
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return fallback;
}

/** Non-cryptographic djb2 hash → base36; used only to fingerprint disclosures. */
function fingerprint(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}

/** Today's date as an ISO yyyy-mm-dd string in UTC. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const CATEGORY_COPY: Record<CookiePolicyCategory["key"], { name: string; description: string }> = {
  essential: {
    name: "Strictly necessary",
    description:
      "Required for the site to function — e.g. security, load balancing, remembering items in a cart, and honoring your privacy choices. These cannot be switched off and do not require consent.",
  },
  functional: {
    name: "Functional",
    description:
      "Enable enhanced functionality and personalization, such as remembering your preferences, region, or language.",
  },
  analytics: {
    name: "Analytics / performance",
    description:
      "Help us understand how visitors use the site by collecting and reporting information anonymously or pseudonymously, so we can measure and improve performance.",
  },
  advertising: {
    name: "Advertising / targeting",
    description:
      "Used to build a profile of your interests and show you relevant advertising on this and other sites, and to measure the effectiveness of advertising campaigns.",
  },
};

const CATEGORY_ORDER: CookiePolicyCategory["key"][] = ["essential", "functional", "analytics", "advertising"];

function consentModelStatement(model: ConsentModel, company: string): string {
  switch (model) {
    case "opt-in":
      return `${company} loads non-essential cookies and similar technologies (analytics and advertising) only after you give consent. You can accept, reject, or customize your choices at any time through our cookie banner, and withdrawing consent is as easy as giving it.`;
    case "opt-out":
      return `${company} may load non-essential cookies by default where permitted by law, but you can opt out at any time through our cookie banner, including opting out of the sale or sharing of your personal information.`;
    case "notice":
      return `${company} uses cookies and similar technologies as described below. By continuing to use the site you acknowledge this use; you can still control cookies through your browser settings and our cookie banner.`;
  }
}

/**
 * Builds a cookie policy document for the given company, jurisdictions and
 * tracking pixels.
 */
export function generateCookiePolicy(input: CookiePolicyInput): CookiePolicyResult {
  const company = input.companyName.trim() || "This website";
  const model = governingConsentModel(input.regions);
  const doNotSell = requiresDoNotSell(input.regions);
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate ?? "")
    ? (input.effectiveDate as string)
    : todayIso();
  const privacyUrl = safeUrl(input.privacyPolicyUrl, DEFAULT_PRIVACY_URL);
  const contactEmail = (input.contactEmail ?? "").trim();
  const regionNames = input.regions.map((r) => REGION_RULES[r].name);

  const uniquePixels = Array.from(new Set(input.pixels));
  const vendors: CookiePolicyVendorRow[] = uniquePixels.map((id) => {
    const v = PIXEL_VENDORS[id];
    return {
      vendor: v.name,
      company: v.company,
      category: v.category,
      purpose: v.purpose,
      dataCategories: v.dataCategories,
      scriptHosts: v.scriptHosts,
      optOutUrl: v.optOutUrl,
      privacyPolicyUrl: v.privacyPolicyUrl,
    };
  });

  const categories: CookiePolicyCategory[] = CATEGORY_ORDER.map((key) => {
    const copy = CATEGORY_COPY[key];
    const catVendors = key === "essential" ? [] : vendors.filter((v) => v.category === key).map((v) => v.vendor);
    return {
      key,
      name: copy.name,
      description: copy.description,
      // Essential is never gated; everything else is gated under opt-in.
      consentRequired: key !== "essential" && model === "opt-in",
      vendors: catVendors,
    };
  }).filter((c) => c.key === "essential" || c.vendors.length > 0 || c.key === "functional");

  // Deterministic version fingerprint: changes when the disclosed content
  // (model, regions, vendors) changes, so consent records can be tied to it.
  const versionSeed = JSON.stringify({
    model,
    regions: [...input.regions].sort(),
    vendors: uniquePixels.slice().sort(),
    doNotSell,
  });
  const policyVersion = `${effectiveDate}.${fingerprint(versionSeed)}`;

  const markdown = renderMarkdown({
    company,
    model,
    doNotSell,
    effectiveDate,
    policyVersion,
    privacyUrl,
    contactEmail,
    websiteUrl: (input.websiteUrl ?? "").trim(),
    regionNames,
    categories,
    vendors,
  });
  const html = renderHtml({
    company,
    model,
    doNotSell,
    effectiveDate,
    policyVersion,
    privacyUrl,
    contactEmail,
    websiteUrl: (input.websiteUrl ?? "").trim(),
    regionNames,
    categories,
    vendors,
  });
  const text = markdown
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\|/g, " ");

  return {
    consentModel: model,
    requiresDoNotSell: doNotSell,
    effectiveDate,
    policyVersion,
    categories,
    vendors,
    regionNames,
    markdown,
    html,
    text,
  };
}

interface RenderContext {
  company: string;
  model: ConsentModel;
  doNotSell: boolean;
  effectiveDate: string;
  policyVersion: string;
  privacyUrl: string;
  contactEmail: string;
  websiteUrl: string;
  regionNames: string[];
  categories: CookiePolicyCategory[];
  vendors: CookiePolicyVendorRow[];
}

const DISCLAIMER =
  "This Cookie Policy is provided by Comply-Quick as a configurable template based on the information supplied. It is not legal advice. Verify it against your actual data practices and applicable law, and consult qualified counsel where appropriate.";

function renderMarkdown(ctx: RenderContext): string {
  const lines: string[] = [];
  lines.push(`# Cookie Policy`);
  lines.push("");
  lines.push(`_Last updated: ${ctx.effectiveDate} · Version ${ctx.policyVersion}_`);
  lines.push("");
  if (ctx.regionNames.length > 0) {
    lines.push(`This policy is written to address the following jurisdictions: ${ctx.regionNames.join(", ")}.`);
    lines.push("");
  }

  lines.push(`## 1. Introduction`);
  const scope = ctx.websiteUrl ? ` on ${ctx.websiteUrl}` : "";
  lines.push(
    `This Cookie Policy explains how ${ctx.company} uses cookies and similar technologies${scope} to recognize you when you visit. It explains what these technologies are, why we use them, and your rights to control their use.`
  );
  lines.push("");

  lines.push(`## 2. What are cookies?`);
  lines.push(
    `Cookies are small data files placed on your device when you visit a website. Similar technologies — such as web beacons, pixels, local storage, and SDKs — perform comparable functions. We refer to all of these collectively as "cookies".`
  );
  lines.push("");

  lines.push(`## 3. Your consent choices`);
  lines.push(consentModelStatement(ctx.model, ctx.company));
  lines.push("");

  lines.push(`## 4. Categories of cookies we use`);
  lines.push("");
  lines.push(`| Category | Consent required | Purpose |`);
  lines.push(`|---|---|---|`);
  for (const c of ctx.categories) {
    lines.push(`| ${mdCell(c.name)} | ${c.consentRequired ? "Yes" : "No"} | ${mdCell(c.description)} |`);
  }
  lines.push("");

  lines.push(`## 5. Third-party cookies and technologies`);
  lines.push("");
  if (ctx.vendors.length > 0) {
    lines.push(
      `We work with the third parties below. Each processes data as an independent controller or our processor for the purposes shown. See each provider's privacy policy for details and opt-out controls.`
    );
    lines.push("");
    lines.push(`| Provider | Category | Purpose | Data collected | Hosts | Privacy policy | Opt-out |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    for (const v of ctx.vendors) {
      lines.push(
        `| ${mdCell(`${v.vendor} (${v.company})`)} | ${mdCell(v.category)} | ${mdCell(v.purpose)} | ${mdCell(
          v.dataCategories.join(", ")
        )} | ${mdCell(v.scriptHosts.join(", "))} | ${mdCell(v.privacyPolicyUrl)} | ${mdCell(v.optOutUrl)} |`
      );
    }
  } else {
    lines.push(
      `We currently use only strictly necessary cookies and do not load third-party analytics or advertising technologies.`
    );
  }
  lines.push("");

  lines.push(`## 6. How to manage your cookies`);
  lines.push(
    `You can change or withdraw your consent at any time through our cookie banner. You can also block or delete cookies through your browser settings, though doing so may affect how the site functions. To manage advertising cookies specifically, use the opt-out links in the table above.`
  );
  if (ctx.doNotSell) {
    lines.push("");
    lines.push(
      `**Do Not Sell or Share My Personal Information.** If you are a resident of a jurisdiction that grants this right (e.g. California under the CCPA/CPRA), you may opt out of the sale or sharing of your personal information using the "Do Not Sell or Share My Personal Information" control in our cookie banner. We also honor the Global Privacy Control (GPC) signal.`
    );
  }
  lines.push("");

  lines.push(`## 7. Changes to this policy`);
  lines.push(
    `We may update this Cookie Policy from time to time to reflect changes to the technologies we use or for legal reasons. The "Last updated" date and version above indicate when it was last revised.`
  );
  lines.push("");

  lines.push(`## 8. Contact us`);
  const contact = ctx.contactEmail
    ? `If you have questions about our use of cookies, contact us at ${ctx.contactEmail}.`
    : `If you have questions about our use of cookies, please contact us.`;
  lines.push(
    `${contact} For more information about how we handle personal data, see our [Privacy Policy](${ctx.privacyUrl}).`
  );
  lines.push("");
  lines.push(`---`);
  lines.push(`_${DISCLAIMER}_`);

  return lines.join("\n");
}

function renderHtml(ctx: RenderContext): string {
  const parts: string[] = [];
  parts.push(`<section class="cq-cookie-policy">`);
  parts.push(`<h1>Cookie Policy</h1>`);
  parts.push(
    `<p class="cq-meta"><em>Last updated: ${escapeHtml(ctx.effectiveDate)} · Version ${escapeHtml(
      ctx.policyVersion
    )}</em></p>`
  );
  if (ctx.regionNames.length > 0) {
    parts.push(
      `<p>This policy is written to address the following jurisdictions: ${escapeHtml(ctx.regionNames.join(", "))}.</p>`
    );
  }

  parts.push(`<h2>1. Introduction</h2>`);
  const scope = ctx.websiteUrl ? ` on ${escapeHtml(ctx.websiteUrl)}` : "";
  parts.push(
    `<p>This Cookie Policy explains how ${escapeHtml(
      ctx.company
    )} uses cookies and similar technologies${scope} to recognize you when you visit. It explains what these technologies are, why we use them, and your rights to control their use.</p>`
  );

  parts.push(`<h2>2. What are cookies?</h2>`);
  parts.push(
    `<p>Cookies are small data files placed on your device when you visit a website. Similar technologies — such as web beacons, pixels, local storage, and SDKs — perform comparable functions. We refer to all of these collectively as &quot;cookies&quot;.</p>`
  );

  parts.push(`<h2>3. Your consent choices</h2>`);
  parts.push(`<p>${escapeHtml(consentModelStatement(ctx.model, ctx.company))}</p>`);

  parts.push(`<h2>4. Categories of cookies we use</h2>`);
  parts.push(`<table><thead><tr><th>Category</th><th>Consent required</th><th>Purpose</th></tr></thead><tbody>`);
  for (const c of ctx.categories) {
    parts.push(
      `<tr><td>${escapeHtml(c.name)}</td><td>${c.consentRequired ? "Yes" : "No"}</td><td>${escapeHtml(
        c.description
      )}</td></tr>`
    );
  }
  parts.push(`</tbody></table>`);

  parts.push(`<h2>5. Third-party cookies and technologies</h2>`);
  if (ctx.vendors.length > 0) {
    parts.push(
      `<p>We work with the third parties below. Each processes data as an independent controller or our processor for the purposes shown. See each provider's privacy policy for details and opt-out controls.</p>`
    );
    parts.push(
      `<table><thead><tr><th>Provider</th><th>Category</th><th>Purpose</th><th>Data collected</th><th>Hosts</th><th>Privacy policy</th><th>Opt-out</th></tr></thead><tbody>`
    );
    for (const v of ctx.vendors) {
      const priv = safeUrl(v.privacyPolicyUrl, "#");
      const opt = safeUrl(v.optOutUrl, "#");
      parts.push(
        `<tr><td>${escapeHtml(v.vendor)} (${escapeHtml(v.company)})</td><td>${escapeHtml(
          v.category
        )}</td><td>${escapeHtml(v.purpose)}</td><td>${escapeHtml(v.dataCategories.join(", "))}</td><td>${escapeHtml(
          v.scriptHosts.join(", ")
        )}</td><td><a href="${escapeHtml(priv)}" rel="noopener noreferrer nofollow" target="_blank">Policy</a></td><td><a href="${escapeHtml(
          opt
        )}" rel="noopener noreferrer nofollow" target="_blank">Opt out</a></td></tr>`
      );
    }
    parts.push(`</tbody></table>`);
  } else {
    parts.push(
      `<p>We currently use only strictly necessary cookies and do not load third-party analytics or advertising technologies.</p>`
    );
  }

  parts.push(`<h2>6. How to manage your cookies</h2>`);
  parts.push(
    `<p>You can change or withdraw your consent at any time through our cookie banner. You can also block or delete cookies through your browser settings, though doing so may affect how the site functions. To manage advertising cookies specifically, use the opt-out links in the table above.</p>`
  );
  if (ctx.doNotSell) {
    parts.push(
      `<p><strong>Do Not Sell or Share My Personal Information.</strong> If you are a resident of a jurisdiction that grants this right (e.g. California under the CCPA/CPRA), you may opt out of the sale or sharing of your personal information using the &quot;Do Not Sell or Share My Personal Information&quot; control in our cookie banner. We also honor the Global Privacy Control (GPC) signal.</p>`
    );
  }

  parts.push(`<h2>7. Changes to this policy</h2>`);
  parts.push(
    `<p>We may update this Cookie Policy from time to time to reflect changes to the technologies we use or for legal reasons. The &quot;Last updated&quot; date and version above indicate when it was last revised.</p>`
  );

  parts.push(`<h2>8. Contact us</h2>`);
  const contact = ctx.contactEmail
    ? `If you have questions about our use of cookies, contact us at ${escapeHtml(ctx.contactEmail)}.`
    : `If you have questions about our use of cookies, please contact us.`;
  parts.push(
    `<p>${contact} For more information about how we handle personal data, see our <a href="${escapeHtml(
      ctx.privacyUrl
    )}">Privacy Policy</a>.</p>`
  );
  parts.push(`<hr /><p class="cq-disclaimer"><em>${escapeHtml(DISCLAIMER)}</em></p>`);
  parts.push(`</section>`);
  return parts.join("\n");
}
