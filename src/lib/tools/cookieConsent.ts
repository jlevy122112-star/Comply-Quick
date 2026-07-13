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
  /** Public managed-deployment id. Adds a verifiable marker and scopes browser persistence. */
  deploymentId?: string;
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
 * Serializes a value for safe inlining inside a generated `<script>` block. Plain
 * `JSON.stringify` does not escape `<`, so a value containing `</script>` could
 * break out of the tag and inject script on a merchant's production site. This
 * escapes the HTML-significant and line-terminator characters that matter inside
 * a script context.
 */
function jsLiteral(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Only enables server-side recording when the endpoint is a trusted absolute
 * HTTPS URL and the project id is a UUID. The endpoint is inlined into a script
 * embedded on merchant sites and carries consent audit data, so a bad scheme
 * (e.g. `javascript:`) must never reach it and plaintext `http:` is rejected to
 * prevent the payload being intercepted or tampered with in transit.
 */
function safeRecordConfig(
  endpoint: string | undefined,
  projectId: string | undefined,
  deploymentId: string | undefined
): { endpoint: string; projectId: string; deploymentId: string | null } | null {
  if (!endpoint || !projectId) return null;
  if (!/^https:\/\//i.test(endpoint.trim())) return null;
  if (!UUID_RE.test(projectId.trim())) return null;
  return {
    endpoint: endpoint.trim(),
    projectId: projectId.trim(),
    deploymentId: UUID_RE.test(deploymentId?.trim() ?? "") ? deploymentId!.trim() : null,
  };
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
  const record = safeRecordConfig(input.recordEndpoint, input.projectId, input.deploymentId);
  const deploymentId = UUID_RE.test(input.deploymentId?.trim() ?? "") ? input.deploymentId!.trim() : null;
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
    ".cq-consent .cq-manage{background:transparent;color:#c7d2fe;border-color:#374151;font-weight:500}",
    ".cq-consent .cq-preferences{margin-top:14px;border-top:1px solid #1f2937;padding-top:12px}",
    ".cq-consent .cq-preferences[hidden]{display:none}",
    ".cq-consent .cq-pref-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;font-size:13px;color:#d1d5db}",
    ".cq-consent .cq-pref-row input{accent-color:" + accent + "}",
    ".cq-consent .cq-pref-actions{display:flex;gap:8px;margin-top:10px}",
    ".cq-consent .cq-save{background:" + accent + ";color:#fff}",
    ".cq-consent .cq-reopen{position:fixed;right:16px;bottom:16px;z-index:2147483646;border:1px solid #374151;border-radius:999px;background:#111827;color:#e5e7eb;padding:8px 12px;font:600 12px ui-sans-serif,system-ui;cursor:pointer}",
    ".cq-consent .cq-reopen[hidden]{display:none}",
  ].join("");

  const dnsButton = doNotSell
    ? `<button type="button" class="cq-dns" data-cq="dns">Do Not Sell or Share My Personal Information</button>`
    : "";

  const html = [
    `<div class="cq-consent" id="cq-consent" data-cq-consent-banner="true"${deploymentId ? ` data-cq-deployment="${deploymentId}"` : ""} role="dialog" aria-live="polite" aria-label="Cookie consent" hidden>`,
    `  <h2>${escapeHtml(copy.heading)}</h2>`,
    `  <p>${escapeHtml(copy.body)} <a href="${escapeHtml(privacyUrl)}">Privacy Policy</a>.</p>`,
    `  <div class="cq-actions">`,
    `    <button type="button" class="cq-accept" data-cq="accept">${escapeHtml(acceptLabel)}</button>`,
    `    <button type="button" class="cq-reject" data-cq="reject">${escapeHtml(rejectLabel)}</button>`,
    `    <button type="button" class="cq-manage" data-cq="manage" aria-expanded="false">Manage preferences</button>`,
    dnsButton ? `    ${dnsButton}` : "",
    `  </div>`,
    `  <div class="cq-preferences" data-cq-preferences hidden>`,
    `    <p>Choose which non-essential categories may load. Essential services are always on.</p>`,
    ...categories.map(
      (category) =>
        `    <label class="cq-pref-row"><span>${escapeHtml(category[0].toUpperCase() + category.slice(1))}</span><input type="checkbox" data-cq-category="${escapeHtml(category)}"></label>`
    ),
    `    <div class="cq-pref-actions"><button type="button" class="cq-save" data-cq="save">Save preferences</button></div>`,
    `  </div>`,
    `</div>`,
    `<button type="button" class="cq-reopen" data-cq-reopen aria-label="Manage cookie preferences" hidden>Cookie preferences</button>`,
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
    `  var DEPLOYMENT=${deploymentId ? jsLiteral(deploymentId) : "null"};`,
    `  var KEY="cq_consent_v1"+(DEPLOYMENT?"_"+DEPLOYMENT:"");`,
    `  var SUBJ_KEY="cq_subject_v1"+(DEPLOYMENT?"_"+DEPLOYMENT:"");`,
    `  var MODEL=${jsLiteral(model)};`,
    `  var CATEGORIES=${jsLiteral(categories)};`,
    `  var RECORD=${record ? jsLiteral(record) : "null"};`,
    `  var POLICY=${input.policyVersion ? jsLiteral(input.policyVersion) : "null"};`,
    `  var REGION=${regionId ? jsLiteral(regionId) : "null"};`,
    `  function read(){try{return JSON.parse(localStorage.getItem(KEY))||null;}catch(e){return null;}}`,
    `  function write(state){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}`,
    `  function rid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,10);}`,
    `  function subject(){try{var s=localStorage.getItem(SUBJ_KEY);if(!s){s=rid();localStorage.setItem(SUBJ_KEY,s);}return s;}catch(e){return rid();}}`,
    `  function emit(state){try{window.dispatchEvent(new CustomEvent("cq:consent",{detail:state}));}catch(e){}}`,
    `  function report(action,cats){`,
    `    if(!RECORD)return;`,
    `    try{`,
    `      var payload=JSON.stringify({projectId:RECORD.projectId,deploymentId:RECORD.deploymentId,subjectRef:subject(),action:action,categories:cats,consentModel:MODEL,policyVersion:POLICY,region:REGION});`,
    `      if(navigator.sendBeacon){navigator.sendBeacon(RECORD.endpoint,new Blob([payload],{type:"text/plain;charset=UTF-8"}));}`,
    `      else{fetch(RECORD.endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:payload,keepalive:true,mode:"cors"}).catch(function(){});}`,
    `    }catch(e){}`,
    `  }`,
    `  var el=document.getElementById("cq-consent");`,
    `  var preferences=el&&el.querySelector("[data-cq-preferences]");`,
    `  var reopen=document.querySelector("[data-cq-reopen]");`,
    `  function gate(state){`,
    `    var allowed=(state&&state.categories)||[];`,
    `    document.querySelectorAll('script[type="text/plain"][data-cq-category]').forEach(function(tag){`,
    `      var cat=tag.getAttribute("data-cq-category");`,
    `      if(cat&&(MODEL==="notice"||allowed.indexOf(cat)>-1)&&!tag.getAttribute("data-cq-loaded")){`,
    `        var script=document.createElement("script");`,
    `        Array.prototype.slice.call(tag.attributes).forEach(function(attr){if(attr.name!=="type"&&attr.name!=="data-cq-category"&&attr.name!=="data-cq-loaded")script.setAttribute(attr.name,attr.value);});`,
    `        script.text=tag.text||"";tag.setAttribute("data-cq-loaded","true");tag.parentNode&&tag.parentNode.insertBefore(script,tag.nextSibling);`,
    `      }`,
    `    });`,
    `  }`,
    `  function apply(state){`,
    `    window.complyQuickConsent={state:state,allows:function(cat){`,
    `      if(cat==="essential")return true;`,
    `      if(MODEL==="notice")return true;`,
    `      if(!state)return MODEL!=="opt-in";`,
    `      return state.categories.indexOf(cat)>-1;`,
    `    }};`,
    `    gate(state);emit(state);`,
    `  }`,
    `  function decide(accepted,action,categories){`,
    `    var cats=categories||(accepted?CATEGORIES.slice():[]);`,
    `    var state={decided:true,at:new Date().toISOString(),categories:cats};`,
    `    write(state);apply(state);report(action||(accepted?"accept_all":"reject_non_essential"),cats);if(el)el.hidden=true;if(reopen)reopen.hidden=false;`,
    `  }`,
    `  var existing=read();`,
    `  apply(existing);`,
    `  if(!existing||!existing.decided){ if(el)el.hidden=false; }else if(reopen){reopen.hidden=false;}`,
    `  function showPreferences(){`,
    `    if(!el)return;el.hidden=false;if(preferences)preferences.hidden=false;`,
    `    var selected=(read()||{}).categories||[];`,
    `    el.querySelectorAll("[data-cq-category]").forEach(function(input){input.checked=selected.indexOf(input.getAttribute("data-cq-category"))>-1;});`,
    `    var manage=el.querySelector('[data-cq="manage"]');if(manage)manage.setAttribute("aria-expanded","true");`,
    `  }`,
    `  if(el){`,
    `    el.addEventListener("click",function(e){`,
    `      var a=e.target&&e.target.getAttribute&&e.target.getAttribute("data-cq");`,
    `      if(a==="accept")decide(true,"accept_all");`,
    `      else if(a==="reject")decide(false,"reject_non_essential");`,
    `      else if(a==="dns"){decide(false,"do_not_sell");}`,
    `      else if(a==="manage")showPreferences();`,
    `      else if(a==="save"){var selected=[];el.querySelectorAll("[data-cq-category]").forEach(function(input){if(input.checked)selected.push(input.getAttribute("data-cq-category"));});decide(false,"custom",selected);}`,
    `    });`,
    `  }`,
    `  if(reopen)reopen.addEventListener("click",showPreferences);`,
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
    `For automatic enforcement, change each non-essential tag to <script type="text/plain" data-cq-category="analytics">…</script>. The banner activates it only after that category is allowed.`,
    `You can also gate programmatic tags on window.complyQuickConsent.allows('advertising') and the "cq:consent" event.`,
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
