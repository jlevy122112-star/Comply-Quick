// Cookie Consent Banner generator.
//
// Produces a framework-agnostic, dependency-free consent banner (HTML + CSS + JS)
// whose behavior is *derived* from the selected jurisdictions and tracking
// pixels rather than hardcoded:
//   * The governing consent model (opt-in / opt-out / notice) is computed from
//     the strictest selected region (see governingConsentModel).
//   * Non-essential scripts are blocked until consent under opt-in; loaded with
//     an opt-out control otherwise.
//   * A "Do Not Sell or Share My Personal Information" control is emitted when a
//     selected region (CCPA/CPRA) requires it.
//
// The generated snippet stores consent in localStorage and exposes a global
// `window.complyQuickConsent` API plus a `cq:consent` event so the host site can
// gate its own tags. Vendor script hosts are surfaced as guidance comments.

import {
  PIXEL_VENDORS,
  REGION_RULES,
  governingConsentModel,
  requiresDoNotSell,
  type ConsentModel,
  type TargetRegion,
  type TrackingPixel,
} from "./data";

export interface CookieConsentInput {
  companyName: string;
  privacyPolicyUrl: string;
  regions: TargetRegion[];
  pixels: TrackingPixel[];
  /** Accent color for the accept button (defaults to the product indigo). */
  accentColor?: string;
  /**
   * When both are provided, the banner also records each decision to the
   * Comply-Quick consent audit trail (server-side proof of consent). Omitting
   * them keeps the banner fully client-side and self-contained.
   */
  recordEndpoint?: string;
  projectId?: string;
  /** Version of the policy the visitor consents against (stored with the record). */
  policyVersion?: string;
}

export interface CookieConsentResult {
  consentModel: ConsentModel;
  requiresDoNotSell: boolean;
  /** Categories the banner exposes toggles for (beyond always-on essential). */
  categories: string[];
  /** The vendors (by pixel) the banner is configured to gate. */
  vendors: { id: TrackingPixel; name: string; company: string; category: string }[];
  html: string;
  css: string;
  js: string;
  /** Single copy-paste snippet (style + markup + script). */
  snippet: string;
  /** Human-readable integration guidance. */
  instructions: string[];
}

const DEFAULT_ACCENT = "#4f46e5";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sanitizes a user-supplied hex color, falling back to the product accent. */
function safeAccent(color: string | undefined): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return DEFAULT_ACCENT;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only enables server-side recording when the endpoint is a trusted absolute
 * HTTPS URL and the project id is a UUID. The endpoint is inlined into a script
 * embedded on merchant sites and carries consent audit data, so a bad scheme
 * (e.g. `javascript:`) must never reach it and plaintext `http:` is rejected to
 * prevent the payload being intercepted or tampered with in transit.
 */
function safeRecordConfig(
  endpoint: string | undefined,
  projectId: string | undefined
): { endpoint: string; projectId: string } | null {
  if (!endpoint || !projectId) return null;
  if (!/^https:\/\//i.test(endpoint.trim())) return null;
  if (!UUID_RE.test(projectId.trim())) return null;
  return { endpoint: endpoint.trim(), projectId: projectId.trim() };
}

/**
 * Sanitizes a user-supplied privacy-policy URL so the generated banner — which
 * merchants embed on production sites — can never carry an executable scheme
 * (e.g. `javascript:`/`data:`). Allows same-origin/relative paths and http(s)
 * and mailto; anything else falls back to a safe relative path.
 */
function safePolicyUrl(url: string): string {
  const value = url.trim();
  if (!value) return "/privacy";
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("./") || value.startsWith("../")) {
    return value;
  }
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return "/privacy";
}

function bannerCopy(model: ConsentModel, company: string): { heading: string; body: string } {
  const who = company.trim() || "We";
  switch (model) {
    case "opt-in":
      return {
        heading: "We value your privacy",
        body: `${who} use cookies and similar technologies to analyze traffic and personalize advertising. We only load non-essential tools after you accept.`,
      };
    case "opt-out":
      return {
        heading: "Your privacy choices",
        body: `${who} use cookies for analytics and advertising. You can opt out of the sale or sharing of your personal information at any time.`,
      };
    case "notice":
      return {
        heading: "Cookie notice",
        body: `${who} use cookies to improve your experience and measure performance. By using this site you acknowledge our use of cookies.`,
      };
  }
}

/** Builds the consent banner assets for the given jurisdictions + pixels. */
export function generateConsentBanner(input: CookieConsentInput): CookieConsentResult {
  const model = governingConsentModel(input.regions);
  const doNotSell = requiresDoNotSell(input.regions);
  const accent = safeAccent(input.accentColor);
  const record = safeRecordConfig(input.recordEndpoint, input.projectId);
  // Coarse region label stored with each consent record: the jurisdiction that
  // governs the consent model (else the first selected region), for audit.
  const regionId = input.regions.find((r) => REGION_RULES[r].consentModel === model) ?? input.regions[0] ?? null;
  const company = input.companyName.trim() || "This website";
  const privacyUrl = safePolicyUrl(input.privacyPolicyUrl);

  const vendors = input.pixels.map((id) => {
    const v = PIXEL_VENDORS[id];
    return { id, name: v.name, company: v.company, category: v.category };
  });
  const categories = Array.from(new Set(vendors.map((v) => v.category)));

  const copy = bannerCopy(model, company);
  const acceptLabel = model === "opt-in" ? "Accept all" : "Got it";
  const rejectLabel = model === "opt-in" ? "Reject non-essential" : "Manage";

  const css = [
    ".cq-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;max-width:520px;margin:0 auto;",
    "background:#0b0f19;color:#e5e7eb;border:1px solid #1f2937;border-radius:14px;padding:18px 20px;",
    "font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.45)}",
    ".cq-consent[hidden]{display:none}",
    ".cq-consent h2{margin:0 0 6px;font-size:15px;font-weight:600;color:#fff}",
    ".cq-consent p{margin:0 0 14px;font-size:13px;line-height:1.5;color:#9ca3af}",
    ".cq-consent a{color:#a5b4fc;text-decoration:underline}",
    ".cq-consent .cq-actions{display:flex;flex-wrap:wrap;gap:8px}",
    ".cq-consent button{cursor:pointer;border-radius:9px;font-size:13px;font-weight:600;padding:9px 14px;border:1px solid transparent}",
    `.cq-consent .cq-accept{background:${accent};color:#fff}`,
    ".cq-consent .cq-reject{background:transparent;color:#e5e7eb;border-color:#374151}",
    ".cq-consent .cq-dns{background:transparent;color:#9ca3af;border-color:#374151;font-weight:500}",
  ].join("");

  const dnsButton = doNotSell
    ? `<button type="button" class="cq-dns" data-cq="dns">Do Not Sell or Share My Personal Information</button>`
    : "";

  const html = [
    `<div class="cq-consent" id="cq-consent" role="dialog" aria-live="polite" aria-label="Cookie consent" hidden>`,
    `  <h2>${escapeHtml(copy.heading)}</h2>`,
    `  <p>${escapeHtml(copy.body)} <a href="${escapeHtml(privacyUrl)}">Privacy Policy</a>.</p>`,
    `  <div class="cq-actions">`,
    `    <button type="button" class="cq-accept" data-cq="accept">${escapeHtml(acceptLabel)}</button>`,
    `    <button type="button" class="cq-reject" data-cq="reject">${escapeHtml(rejectLabel)}</button>`,
    dnsButton ? `    ${dnsButton}` : "",
    `  </div>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  const vendorComment =
    vendors.length > 0
      ? vendors.map((v) => ` *   - ${v.name} (${v.company}) [${v.category}]`).join("\n")
      : " *   (no advertising/analytics vendors selected)";

  const js = [
    `<script>`,
    `/**`,
    ` * Comply-Quick consent banner — model: ${model}${doNotSell ? " + Do-Not-Sell" : ""}.`,
    ` * Gate your tags on window.complyQuickConsent.allows('advertising'|'analytics').`,
    ` * Vendors configured to be gated:`,
    vendorComment,
    ` */`,
    `(function(){`,
    `  var KEY="cq_consent_v1";`,
    `  var SUBJ_KEY="cq_subject_v1";`,
    `  var MODEL=${JSON.stringify(model)};`,
    `  var CATEGORIES=${JSON.stringify(categories)};`,
    `  var RECORD=${record ? JSON.stringify({ endpoint: record.endpoint, projectId: record.projectId }) : "null"};`,
    `  var POLICY=${input.policyVersion ? JSON.stringify(input.policyVersion) : "null"};`,
    `  var REGION=${regionId ? JSON.stringify(regionId) : "null"};`,
    `  function read(){try{return JSON.parse(localStorage.getItem(KEY))||null;}catch(e){return null;}}`,
    `  function write(state){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}`,
    `  function subject(){try{var s=localStorage.getItem(SUBJ_KEY);if(!s){s=(Date.now().toString(36)+Math.random().toString(36).slice(2,10));localStorage.setItem(SUBJ_KEY,s);}return s;}catch(e){return "anon";}}`,
    `  function emit(state){try{window.dispatchEvent(new CustomEvent("cq:consent",{detail:state}));}catch(e){}}`,
    `  function report(action,cats){`,
    `    if(!RECORD)return;`,
    `    try{`,
    `      var payload=JSON.stringify({projectId:RECORD.projectId,subjectRef:subject(),action:action,categories:cats,consentModel:MODEL,policyVersion:POLICY,region:REGION});`,
    `      if(navigator.sendBeacon){navigator.sendBeacon(RECORD.endpoint,new Blob([payload],{type:"application/json"}));}`,
    `      else{fetch(RECORD.endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:payload,keepalive:true,mode:"cors"}).catch(function(){});}`,
    `    }catch(e){}`,
    `  }`,
    `  var el=document.getElementById("cq-consent");`,
    `  function apply(state){`,
    `    window.complyQuickConsent={state:state,allows:function(cat){`,
    `      if(cat==="essential")return true;`,
    `      if(MODEL==="notice")return true;`,
    `      if(!state)return MODEL!=="opt-in";`,
    `      return state.categories.indexOf(cat)>-1;`,
    `    }};`,
    `    emit(state);`,
    `  }`,
    `  function decide(accepted,action){`,
    `    var cats=accepted?CATEGORIES.slice():[];`,
    `    var state={decided:true,at:new Date().toISOString(),categories:cats};`,
    `    write(state);apply(state);report(action||(accepted?"accept_all":"reject_non_essential"),cats);if(el)el.hidden=true;`,
    `  }`,
    `  var existing=read();`,
    `  apply(existing);`,
    `  if(!existing||!existing.decided){ if(el)el.hidden=false; }`,
    `  if(el){`,
    `    el.addEventListener("click",function(e){`,
    `      var a=e.target&&e.target.getAttribute&&e.target.getAttribute("data-cq");`,
    `      if(a==="accept")decide(true,"accept_all");`,
    `      else if(a==="reject")decide(false,"reject_non_essential");`,
    `      else if(a==="dns"){decide(false,"do_not_sell");}`,
    `    });`,
    `  }`,
    `})();`,
    `</script>`,
  ].join("\n");

  const snippet = `<!-- Comply-Quick Cookie Consent Banner -->\n<style>\n${css}\n</style>\n${html}\n${js}`;

  const instructions = [
    `Paste the snippet just before the closing </body> tag on every page.`,
    model === "opt-in"
      ? `Opt-in model (strictest selected region: ${strictestRegionName(input.regions)}). Do NOT load analytics/advertising tags until window.complyQuickConsent.allows('advertising') is true.`
      : model === "opt-out"
        ? `Opt-out model (${strictestRegionName(input.regions)}). Tags may load by default, but honor opt-out via the banner and the "cq:consent" event.`
        : `Notice model. Disclose cookie usage; no blocking required, but keep the notice visible until acknowledged.`,
    `Gate each vendor tag on its category, e.g. if (window.complyQuickConsent.allows('advertising')) { /* load Meta Pixel */ }.`,
    doNotSell
      ? `A "Do Not Sell or Share" control is included to satisfy CCPA/CPRA. Wire it to your data-sharing opt-out signal (e.g. Global Privacy Control).`
      : `Update the Privacy Policy link if your policy lives at a different path than ${privacyUrl}.`,
  ];

  return {
    consentModel: model,
    requiresDoNotSell: doNotSell,
    categories,
    vendors,
    html,
    css,
    js,
    snippet,
    instructions,
  };
}

function strictestRegionName(regions: TargetRegion[]): string {
  const model = governingConsentModel(regions);
  const match = regions.find((r) => REGION_RULES[r].consentModel === model);
  return match ? REGION_RULES[match].name : "EU / EEA / UK (GDPR)";
}
