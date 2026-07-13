// Compliance Scanner analyzer (Phase 3).
//
// Pure, dependency-free analysis of a fetched HTML document: fingerprint the
// third-party tools present, derive compliance findings, and compute a score.
// No network/DB/AI here so it is fully unit-testable and safe to run anywhere.

export type ToolCategory =
  | "analytics"
  | "advertising"
  | "session_replay"
  | "chat"
  | "consent"
  | "tag_manager"
  | "payments"
  | "cdp"
  // Real-user / behavioral monitoring (Datadog RUM etc.) — session-level data,
  // treated as a consent-gated tracker.
  | "monitoring"
  // Pure error/crash monitoring (Sentry etc.) — no behavioral session tracking,
  // so NOT consent-gated by default. Kept a distinct category so the tracker
  // classification below never sweeps it into the consent-warning path.
  | "error_monitoring";

export interface DetectedTool {
  id: string;
  name: string;
  category: ToolCategory;
  /** Plain-language compliance classification for the scanner and workspace. */
  classification?: TrackerClassification;
}

export interface TrackerClassification {
  label: string;
  consentRequired: boolean;
  detail: string;
}

export type Severity = "info" | "warning" | "critical";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  detail: string;
  recommendation: string;
}

export interface ScanAnalysis {
  detectedTools: DetectedTool[];
  findings: Finding[];
  score: number;
  hasConsentBanner: boolean;
  hasPrivacyPolicy: boolean;
}

interface Fingerprint {
  id: string;
  name: string;
  category: ToolCategory;
  /** Strong, vendor-specific signals (CDN/SDK hostnames, unique globals). */
  patterns: RegExp[];
  /**
   * Generic, easily-collided signals (e.g. an `analytics.track(` shape shared by
   * many libraries). These still register a detection so nothing is missed, but
   * on their own they can only produce a LOW-confidence hint — never a
   * high-confidence detection — to keep false positives out of the strong set.
   */
  weakPatterns?: RegExp[];
}

// Fingerprints match well-known script hosts / global calls. Ordered roughly by
// compliance risk; extend as new tools appear (mirrors the wizard's pixel list
// plus higher-risk session-replay/chat tools driving CIPA wiretapping suits).
const FINGERPRINTS: Fingerprint[] = [
  {
    id: "meta",
    name: "Meta Pixel",
    category: "advertising",
    patterns: [/connect\.facebook\.net/i, /fbq\(/, /facebook\.com\/tr\b/i],
  },
  {
    id: "google",
    name: "Google Analytics / Ads",
    category: "analytics",
    patterns: [
      /google-analytics\.com/i,
      /gtag\(/,
      /googletagmanager\.com\/gtag/i,
      /\/(g|r|j|collect)\/collect\b/i,
      /region\d+\.google-analytics\.com/i,
      /\.googlesyndication\.com/i,
      /\.doubleclick\.net/i,
    ],
  },
  { id: "gtm", name: "Google Tag Manager", category: "tag_manager", patterns: [/googletagmanager\.com\/gtm\.js/i] },
  { id: "tiktok", name: "TikTok Pixel", category: "advertising", patterns: [/analytics\.tiktok\.com/i, /ttq\./] },
  {
    id: "linkedin",
    name: "LinkedIn Insight",
    category: "advertising",
    patterns: [/snap\.licdn\.com/i, /_linkedin_partner_id/i, /px\.ads\.linkedin\.com/i],
  },
  {
    id: "pinterest",
    name: "Pinterest Tag",
    category: "advertising",
    patterns: [/s\.pinimg\.com/i, /pintrk\(/, /ct\.pinterest\.com/i],
  },
  {
    id: "snapchat",
    name: "Snapchat Pixel",
    category: "advertising",
    patterns: [/sc-static\.net/i, /snaptr\(/, /tr\.snapchat\.com/i],
  },
  { id: "hotjar", name: "Hotjar", category: "session_replay", patterns: [/static\.hotjar\.com/i, /hjSetting/] },
  {
    id: "fullstory",
    name: "FullStory",
    category: "session_replay",
    patterns: [/fullstory\.com\/s\/fs\.js/i, /\bFS\.identify\b/],
  },
  { id: "clarity", name: "Microsoft Clarity", category: "session_replay", patterns: [/clarity\.ms/i, /clarity\(/] },
  { id: "intercom", name: "Intercom", category: "chat", patterns: [/widget\.intercom\.io/i, /intercomSettings/] },
  { id: "drift", name: "Drift", category: "chat", patterns: [/js\.driftt\.com/i, /drift\.load/i] },
  { id: "cookiebot", name: "Cookiebot", category: "consent", patterns: [/consent\.cookiebot\.com/i] },
  { id: "onetrust", name: "OneTrust", category: "consent", patterns: [/cdn\.cookielaw\.org/i, /onetrust/i] },
  { id: "termly", name: "Termly", category: "consent", patterns: [/app\.termly\.io/i] },
  { id: "osano", name: "Osano", category: "consent", patterns: [/cmp\.osano\.com/i] },
  {
    id: "comply_quick_consent",
    name: "Comply-Quick Consent",
    category: "consent",
    patterns: [/data-cq-consent-banner/i, /complyQuickConsent/i],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    patterns: [/js\.stripe\.com/i, /\bStripe\(/, /checkout\.stripe\.com/i],
  },
  { id: "paypal", name: "PayPal", category: "payments", patterns: [/paypal\.com\/sdk/i, /paypalobjects\.com/i] },
  { id: "square", name: "Square", category: "payments", patterns: [/squarecdn\.com/i, /js\.squareup\.com/i] },
  {
    id: "segment",
    name: "Segment",
    category: "cdp",
    // Only Segment's CDN host is authoritative. The bundle filename
    // (`analytics.min.js`) and the `analytics.track()`-style call shape are both
    // generic — shared by many self-hosted analytics wrappers — so they are weak
    // hints and can't alone yield a high-confidence Segment match.
    patterns: [/cdn\.segment\.(com|io)/i],
    weakPatterns: [/analytics\.min\.js/i, /analytics\.(track|identify|page)\(/],
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "error_monitoring",
    patterns: [/browser\.sentry-cdn\.com/i, /@sentry\//i, /Sentry\.init/],
  },
  { id: "datadog", name: "Datadog RUM", category: "monitoring", patterns: [/datadoghq-browser-agent/i, /DD_RUM/] },
];

/**
 * Explains how a detected integration should be handled. This deliberately
 * distinguishes behavioral monitoring from error diagnostics so teams can
 * prioritize real consent obligations without hiding operational telemetry.
 */
export function classifyTracker(category: string): TrackerClassification {
  if (CONSENT_GATED_TRACKER_CATEGORIES.includes(category as ToolCategory)) {
    return {
      label: category === "monitoring" ? "Behavioral monitoring — consent required" : "Consent-gated tracker",
      consentRequired: true,
      detail: "Block until the visitor grants the applicable category preference.",
    };
  }
  if (category === "error_monitoring") {
    return {
      label: "Error monitoring — review configuration",
      consentRequired: false,
      detail: "Keep diagnostics minimized and avoid sending session-replay or unnecessary personal data.",
    };
  }
  if (category === "consent") {
    return {
      label: "Consent management",
      consentRequired: false,
      detail: "Verify that configured categories are blocked before a preference is saved.",
    };
  }
  return {
    label: "Operational integration",
    consentRequired: false,
    detail: "Review its data handling and disclose it in your privacy documentation.",
  };
}

/**
 * Maps third-party service ids to scanner categories for catalog cross-checks.
 * The Comply-Quick marker proves that the site's banner is present; it is not
 * an external service whose processing role belongs in the vendor catalog.
 */
export const FINGERPRINT_CATEGORIES: Readonly<Record<string, ToolCategory>> = Object.fromEntries(
  FINGERPRINTS.filter((fp) => fp.id !== "comply_quick_consent").map((fp) => [fp.id, fp.category])
);

export const SEVERITY_PENALTY: Record<Severity, number> = { info: 3, warning: 12, critical: 25 };

/**
 * Tool categories treated as consent-gated behavioral trackers. These observe
 * or transmit user behavior and therefore require prior consent under
 * GDPR/ePrivacy best practice. `chat` (Intercom, Drift) is included because
 * such widgets load on page-load and set persistent identifying cookies before
 * any interaction; `error_monitoring` (Sentry) is deliberately excluded as pure
 * diagnostics. This set is the single source of truth shared by the scanner and
 * cross-checked against the catalog's `consentGated` flags (see catalog tests).
 */
export const CONSENT_GATED_TRACKER_CATEGORIES: readonly ToolCategory[] = [
  "advertising",
  "analytics",
  "chat",
  "session_replay",
  "cdp",
  "monitoring",
];

/**
 * Fingerprints the third-party tools referenced in the page.
 *
 * `html` is the rendered/served markup. `requestUrls` are outbound network
 * requests captured while the page loaded (only available when the page was
 * rendered by the headless scanner worker) — these reveal JS-injected pixels
 * (Meta, TikTok, etc.) that never appear in the static HTML.
 */
export function detectTools(html: string, requestUrls: string[] = []): DetectedTool[] {
  const haystack = requestUrls.length > 0 ? `${html}\n${requestUrls.join("\n")}` : html;
  const found: DetectedTool[] = [];
  for (const fp of FINGERPRINTS) {
    // Boolean view reports a match ONLY on a strong, vendor-specific signal.
    // Weak patterns are generic (shared by many self-hosted bundles), so they
    // are low-confidence hints for `detectToolsDetailed` and must never, on
    // their own, produce a definite detection here — otherwise a generic
    // `analytics.min.js` would falsely feed the consent-gated tracker findings
    // in `analyzeHtml`. Every fingerprint has strong patterns, so real installs
    // are unaffected.
    const matched = fp.patterns.some((p) => p.test(haystack));
    if (matched) {
      found.push({ id: fp.id, name: fp.name, category: fp.category, classification: classifyTracker(fp.category) });
    }
  }
  return found;
}

/** Which signal layer a fingerprint matched in. */
export type DetectionLayer = "html" | "runtime" | "both";

/**
 * A detected tool enriched with deterministic confidence and provenance so the
 * accuracy engine never has to "guess": we record exactly which regex signals
 * fired and in which layer, then derive a confidence score from that evidence.
 */
export interface DetectedToolDetail extends DetectedTool {
  /** Detection confidence in [0, 1], rounded to 2dp. */
  confidence: number;
  /** Layer(s) the tool's signals were observed in. */
  layer: DetectionLayer;
  /** The raw regex sources that matched (evidence for the audit trail). */
  signals: string[];
  /**
   * True when the detection is backed ONLY by generic/weak signals (no
   * vendor-specific strong signal fired), so confidence is capped at
   * WEAK_ONLY_CONFIDENCE_CAP. Such detections are low-confidence hints for
   * transparency and MUST NOT drive definite compliance obligations — see
   * buildObligationReport, which filters them out before deriving obligations.
   */
  isWeakOnly: boolean;
}

// Deterministic confidence model. A runtime/network match (the tool actually
// loaded) is far stronger evidence than a static-HTML string match (which could
// be a mention or a dead link). Confidence grows with the number of distinct
// strong signals and is highest when corroborated across both layers. A match
// backed only by generic/weak signals is capped to a low-confidence hint.

/** Max confidence a detection backed ONLY by generic/weak signals may reach. */
const WEAK_ONLY_CONFIDENCE_CAP = 0.3;

function layerFor(htmlMatches: number, runtimeMatches: number): DetectionLayer {
  return htmlMatches > 0 && runtimeMatches > 0 ? "both" : runtimeMatches > 0 ? "runtime" : "html";
}

function scoreConfidence(
  htmlMatches: number,
  runtimeMatches: number,
  distinctStrongPatterns: number,
  weakPresent: boolean
): { confidence: number; layer: DetectionLayer } {
  const layer = layerFor(htmlMatches, runtimeMatches);
  let confidence = runtimeMatches > 0 ? 0.7 : 0.5;
  // Reward *distinct* corroborating strong patterns (not the sum across layers,
  // which would double-count a pattern that matched in both). Cross-layer
  // agreement is credited separately below.
  confidence += Math.min(0.2, (distinctStrongPatterns - 1) * 0.1);
  if (layer === "both") confidence += 0.15; // cross-layer agreement
  // A weak signal only nudges an already-strong detection; it never carries one.
  if (weakPresent) confidence += 0.05;
  confidence = Math.max(0, Math.min(1, confidence));
  return { confidence: Math.round(confidence * 100) / 100, layer };
}

/**
 * Confidence for a detection with NO strong signal — only generic hints matched.
 * Capped low so a shared API shape (e.g. `analytics.track(`) can never masquerade
 * as a confident detection on its own.
 */
function scoreWeakOnly(htmlMatches: number, runtimeMatches: number): { confidence: number; layer: DetectionLayer } {
  const layer = layerFor(htmlMatches, runtimeMatches);
  const confidence = runtimeMatches > 0 ? WEAK_ONLY_CONFIDENCE_CAP : WEAK_ONLY_CONFIDENCE_CAP - 0.05;
  return { confidence: Math.round(confidence * 100) / 100, layer };
}

/**
 * Like {@link detectTools} but returns per-tool confidence, detection layer, and
 * the matched signals. This is the deterministic, multi-layered detection the
 * accuracy engine consumes; `detectTools` remains the simple boolean view.
 */
export function detectToolsDetailed(html: string, requestUrls: string[] = []): DetectedToolDetail[] {
  const runtime = requestUrls.join("\n");
  const found: DetectedToolDetail[] = [];
  for (const fp of FINGERPRINTS) {
    const strongSignals: string[] = [];
    let strongHtml = 0;
    let strongRuntime = 0;
    for (const p of fp.patterns) {
      const inHtml = p.test(html);
      const inRuntime = runtime.length > 0 && p.test(runtime);
      if (inHtml) strongHtml += 1;
      if (inRuntime) strongRuntime += 1;
      if (inHtml || inRuntime) strongSignals.push(p.source);
    }
    const weakSignals: string[] = [];
    let weakHtml = 0;
    let weakRuntime = 0;
    for (const p of fp.weakPatterns ?? []) {
      const inHtml = p.test(html);
      const inRuntime = runtime.length > 0 && p.test(runtime);
      if (inHtml) weakHtml += 1;
      if (inRuntime) weakRuntime += 1;
      if (inHtml || inRuntime) weakSignals.push(p.source);
    }
    const strongMatches = strongHtml + strongRuntime;
    const weakMatches = weakHtml + weakRuntime;
    if (strongMatches + weakMatches === 0) continue;
    // A strong signal drives the full model; a weak-only detection is a capped
    // hint. `signals` lists every distinct pattern that matched (strong first)
    // as evidence for the audit trail.
    const signals = [...strongSignals, ...weakSignals];
    const isWeakOnly = strongMatches === 0;
    const { confidence, layer } = isWeakOnly
      ? scoreWeakOnly(weakHtml, weakRuntime)
      : scoreConfidence(strongHtml, strongRuntime, strongSignals.length, weakMatches > 0);
    found.push({
      id: fp.id,
      name: fp.name,
      category: fp.category,
      classification: classifyTracker(fp.category),
      confidence,
      layer,
      signals,
      isWeakOnly,
    });
  }
  return found;
}

function hasPrivacyPolicyLink(html: string): boolean {
  return /href\s*=\s*["'][^"']*privacy[^"']*["']/i.test(html) || /privacy policy/i.test(html);
}

function hasTermsLink(html: string): boolean {
  return /href\s*=\s*["'][^"']*(terms|tos)[^"']*["']/i.test(html) || /terms of (service|use)/i.test(html);
}

/**
 * Analyzes fetched HTML: detects tools, derives compliance findings, and scores.
 * Deterministic; the score starts at 100 and is reduced by finding severity.
 */
export function analyzeHtml(html: string, requestUrls: string[] = []): ScanAnalysis {
  const detectedTools = detectTools(html, requestUrls);
  const findings: Finding[] = [];

  const consentTools = detectedTools.filter((t) => t.category === "consent");
  // Consent-gated trackers: everything that observes/transmits user behavior.
  // The category set is the single source of truth shared with the catalog's
  // `consentGated` flags (see CONSENT_GATED_TRACKER_CATEGORIES).
  const trackers = detectedTools.filter((t) => CONSENT_GATED_TRACKER_CATEGORIES.includes(t.category));
  const sessionReplay = detectedTools.filter((t) => t.category === "session_replay");
  const hasConsentBanner = consentTools.length > 0;
  const hasPrivacyPolicy = hasPrivacyPolicyLink(html);

  if (trackers.length > 0 && !hasConsentBanner) {
    findings.push({
      id: "trackers_without_consent",
      title: "Trackers load without a consent banner",
      severity: "critical",
      detail: `Detected ${trackers.length} tracking/analytics tool(s) (${trackers.map((t) => t.name).join(", ")}) but no consent management platform.`,
      recommendation:
        "Add a consent banner (e.g. Cookiebot, OneTrust) that blocks non-essential scripts until the visitor opts in.",
    });
  }

  if (sessionReplay.length > 0) {
    findings.push({
      id: "session_replay_present",
      title: "Session-replay tooling detected",
      severity: "warning",
      detail: `${sessionReplay.map((t) => t.name).join(", ")} can record user sessions — a frequent target of CIPA/wiretapping claims.`,
      recommendation: "Disclose session recording explicitly and gate it behind consent; mask sensitive inputs.",
    });
  }

  if (!hasPrivacyPolicy) {
    findings.push({
      id: "missing_privacy_policy",
      title: "No privacy policy link found",
      severity: "critical",
      detail:
        "The page does not link to a privacy policy, which is required in most jurisdictions when collecting any personal data.",
      recommendation: "Publish a privacy policy and link it from the footer of every page.",
    });
  }

  if (!hasTermsLink(html)) {
    findings.push({
      id: "missing_terms",
      title: "No terms of service link found",
      severity: "warning",
      detail: "No terms of service / terms of use link was detected.",
      recommendation: "Add clear customer-facing terms and link them from the footer.",
    });
  }

  if (trackers.length > 0 && hasConsentBanner) {
    findings.push({
      id: "consent_present",
      title: "Consent management detected",
      severity: "info",
      detail: `A consent platform (${consentTools.map((t) => t.name).join(", ")}) is present alongside tracking tools.`,
      recommendation:
        "Verify the banner actually blocks scripts pre-consent (many are misconfigured to fire immediately).",
    });
  }

  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity] * (f.severity === "info" ? 0 : 1), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { detectedTools, findings, score, hasConsentBanner, hasPrivacyPolicy };
}
