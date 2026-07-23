// GitHub repo parser for compliance signals.
//
// Lightweight static analysis of repository files. Looks for markers that indicate
// privacy policy presence, cookie/tracker disclosures, consent snippets, or
// places where sensitive data handling may need review. Built without external
// dependencies so it can run in workers as well as the Next.js app.

export type FindingType =
  | "missing_privacy_policy"
  | "missing_cookie_disclosure"
  | "tracker_detected"
  | "consent_snippet"
  | "sensitive_data"
  | "data_sharing";

export type Severity = "low" | "medium" | "high";

export interface RepoFinding {
  type: FindingType;
  severity: Severity;
  message: string;
  path?: string;
  lineNumber?: number;
  metadata: Record<string, unknown>;
}

export interface RepoFile {
  path: string;
  content: string;
}

const TRACKER_PATTERNS = [
  { name: "Google Analytics", regex: /google-analytics\.com|googletagmanager\.com|gtag\(/gi },
  { name: "Facebook Pixel", regex: /connect\.facebook\.net|fbevents\.js|fbq\(/gi },
  { name: "Hotjar", regex: /hotjar\.com|hjid/gi },
  { name: "Mixpanel", regex: /mixpanel\.com|mixpanel\(/gi },
  { name: "Segment", regex: /segment\.com|analytics\.load|segment\.io/gi },
];

const SENSITIVE_KEYWORDS = ["ssn", "password", "api_key", "apikey", "secret", "token", "credit_card"];

function hasReadmePrivacyPolicy(files: RepoFile[]): boolean {
  const readme = files.find((f) => /^readme\.md$/i.test(f.path));
  if (!readme) return false;
  return /privacy\s*policy|privacy\s*notice/i.test(readme.content);
}

function hasCookieDisclosure(files: RepoFile[]): boolean {
  return files.some((f) => /cookie/i.test(f.path) && /cookie|consent/i.test(f.content));
}

function hasPrivacyPolicyFile(files: RepoFile[]): boolean {
  return files.some((f) => /privacy|privacypolicy/i.test(f.path));
}

function hasTermsFile(files: RepoFile[]): boolean {
  return files.some((f) => /terms|tos|terms-of-service/i.test(f.path));
}

function* scanFileForTrackers(file: RepoFile): Generator<RepoFinding> {
  for (const { name, regex } of TRACKER_PATTERNS) {
    const matches = file.content.match(regex);
    if (matches && matches.length > 0) {
      yield {
        type: "tracker_detected",
        severity: "medium",
        message: `Detected ${name} tracker reference.`,
        path: file.path,
        lineNumber: lineNumberForMatch(file.content, matches[0]),
        metadata: { tracker: name, occurrences: matches.length },
      };
    }
  }
}

function* scanFileForConsentSnippet(file: RepoFile): Generator<RepoFinding> {
  const consentPatterns = [/cookieconsent/i, /onetrust/i, /cookiebot/i, /osano/i, /consent-manager/i, /gdpr.*consent/i];
  for (const pattern of consentPatterns) {
    if (pattern.test(file.content)) {
      yield {
        type: "consent_snippet",
        severity: "low",
        message: "Detected a cookie/consent management snippet.",
        path: file.path,
        lineNumber: lineNumberForMatch(file.content, pattern.source),
        metadata: { pattern: pattern.source },
      };
      break;
    }
  }
}

function* scanFileForSensitiveData(file: RepoFile): Generator<RepoFinding> {
  for (const keyword of SENSITIVE_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = file.content.match(regex);
    if (matches && matches.length > 0) {
      yield {
        type: "sensitive_data",
        severity: "high",
        message: `Detected sensitive keyword "${keyword}" — review data handling.`,
        path: file.path,
        lineNumber: lineNumberForMatch(file.content, keyword),
        metadata: { keyword, occurrences: matches.length },
      };
    }
  }
}

function lineNumberForMatch(content: string, query: string): number | undefined {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return undefined;
  return content.slice(0, index).split("\n").length;
}

/**
 * Parses a repository snapshot and returns compliance-oriented findings.
 */
export function parseRepo(repoFullName: string, files: RepoFile[]): RepoFinding[] {
  const findings: RepoFinding[] = [];

  if (!hasPrivacyPolicyFile(files) && !hasReadmePrivacyPolicy(files)) {
    findings.push({
      type: "missing_privacy_policy",
      severity: "medium",
      message: "No privacy policy file or README privacy section found.",
      metadata: { repoFullName },
    });
  }

  if (!hasCookieDisclosure(files) && !hasTermsFile(files)) {
    findings.push({
      type: "missing_cookie_disclosure",
      severity: "medium",
      message: "No cookie/terms disclosure file found.",
      metadata: { repoFullName },
    });
  }

  for (const file of files) {
    findings.push(...scanFileForTrackers(file));
    findings.push(...scanFileForConsentSnippet(file));
    findings.push(...scanFileForSensitiveData(file));
  }

  return findings;
}
