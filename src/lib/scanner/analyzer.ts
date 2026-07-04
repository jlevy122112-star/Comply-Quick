// Compliance Scanner analyzer (Phase 3).
//
// Pure, dependency-free analysis of a fetched HTML document: fingerprint the
// third-party tools present, derive compliance findings, and compute a score.
// No network/DB/AI here so it is fully unit-testable and safe to run anywhere.

export type ToolCategory = "analytics" | "advertising" | "session_replay" | "chat" | "consent" | "tag_manager";

export interface DetectedTool {
  id: string;
  name: string;
  category: ToolCategory;
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
  patterns: RegExp[];
}

// Fingerprints match well-known script hosts / global calls. Ordered roughly by
// compliance risk; extend as new tools appear (mirrors the wizard's pixel list
// plus higher-risk session-replay/chat tools driving CIPA wiretapping suits).
const FINGERPRINTS: Fingerprint[] = [
  { id: "meta", name: "Meta Pixel", category: "advertising", patterns: [/connect\.facebook\.net/i, /fbq\(/] },
  {
    id: "google",
    name: "Google Analytics / Ads",
    category: "analytics",
    patterns: [/google-analytics\.com/i, /gtag\(/, /googletagmanager\.com\/gtag/i],
  },
  { id: "gtm", name: "Google Tag Manager", category: "tag_manager", patterns: [/googletagmanager\.com\/gtm\.js/i] },
  { id: "tiktok", name: "TikTok Pixel", category: "advertising", patterns: [/analytics\.tiktok\.com/i, /ttq\./] },
  {
    id: "linkedin",
    name: "LinkedIn Insight",
    category: "advertising",
    patterns: [/snap\.licdn\.com/i, /_linkedin_partner_id/i],
  },
  { id: "pinterest", name: "Pinterest Tag", category: "advertising", patterns: [/s\.pinimg\.com/i, /pintrk\(/] },
  { id: "snapchat", name: "Snapchat Pixel", category: "advertising", patterns: [/sc-static\.net/i, /snaptr\(/] },
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
];

const SEVERITY_PENALTY: Record<Severity, number> = { info: 3, warning: 12, critical: 25 };

/** Fingerprints the third-party tools referenced in the HTML. */
export function detectTools(html: string): DetectedTool[] {
  const found: DetectedTool[] = [];
  for (const fp of FINGERPRINTS) {
    if (fp.patterns.some((p) => p.test(html))) {
      found.push({ id: fp.id, name: fp.name, category: fp.category });
    }
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
export function analyzeHtml(html: string): ScanAnalysis {
  const detectedTools = detectTools(html);
  const findings: Finding[] = [];

  const consentTools = detectedTools.filter((t) => t.category === "consent");
  const trackers = detectedTools.filter(
    (t) => t.category === "advertising" || t.category === "analytics" || t.category === "session_replay"
  );
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
