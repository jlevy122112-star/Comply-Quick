import type { Finding, Severity } from "./analyzer";

export type AccessibilityImpact = "critical" | "serious" | "moderate" | "minor" | null | undefined;

export interface AccessibilityNode {
  target: string[] | string;
}

export interface AccessibilityViolation {
  id: string;
  impact: AccessibilityImpact;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AccessibilityNode[];
  recommendation?: string;
}

export interface AccessibilityAnalysis {
  score: number;
  findings: Finding[];
  violations: AccessibilityViolation[];
  source: "axe" | "static";
}

const IMPACT_SEVERITY: Record<Exclude<AccessibilityImpact, null | undefined>, Severity> = {
  critical: "critical",
  serious: "critical",
  moderate: "warning",
  minor: "info",
};

const IMPACT_PENALTY: Record<Exclude<AccessibilityImpact, null | undefined>, number> = {
  critical: 25,
  serious: 18,
  moderate: 10,
  minor: 4,
};

function impactSeverity(impact: AccessibilityImpact): Severity {
  return impact ? IMPACT_SEVERITY[impact] : "warning";
}

function impactPenalty(impact: AccessibilityImpact): number {
  return impact ? IMPACT_PENALTY[impact] : 10;
}

function nodeTarget(node: AccessibilityNode): string {
  return Array.isArray(node.target) ? node.target.join(", ") : node.target;
}

function wcagReference(tag: string): string | undefined {
  const match = /^wcag(\d)(\d)(\d)$/.exec(tag);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : undefined;
}

function remediationFor(violation: AccessibilityViolation): string {
  const remediations: Record<string, string> = {
    "color-contrast": "Update foreground and background colors to meet the applicable WCAG contrast ratio.",
    "document-title": "Add a concise, descriptive title element that identifies the page.",
    "html-has-lang": "Add a valid lang attribute to the html element matching the page's primary language.",
    "image-alt": "Add meaningful alt text to informative images and use an empty alt attribute for decorative images.",
    label: "Associate every form control with a visible label using a label element or an accessible name.",
    "link-name": "Give every link a descriptive accessible name that explains its destination.",
    "button-name": "Give every button a visible label or an accessible name describing its action.",
    "heading-order": "Use heading levels in a logical sequence without skipping levels.",
  };
  return (
    remediations[violation.id] ??
    `Resolve the ${violation.help.toLowerCase()} issue by following the linked WCAG guidance and retest the affected component.`
  );
}

function toFinding(violation: AccessibilityViolation): Finding {
  const references = violation.tags
    .map(wcagReference)
    .filter((reference): reference is string => reference !== undefined);
  const referenceText = references.length > 0 ? ` WCAG success criteria: ${references.join(", ")}.` : "";
  const locations = violation.nodes.length > 0 ? ` Affected nodes: ${violation.nodes.map(nodeTarget).join("; ")}.` : "";
  const helpUrl = violation.helpUrl ? ` Guidance: ${violation.helpUrl}` : "";
  return {
    id: `accessibility.${violation.id}`,
    title: violation.help,
    severity: impactSeverity(violation.impact),
    detail: `${violation.description}.${referenceText} ${violation.nodes.length} affected node(s).${locations}${helpUrl}`,
    recommendation: violation.recommendation ?? remediationFor(violation),
  };
}

function staticViolation(
  id: string,
  impact: Exclude<AccessibilityImpact, null | undefined>,
  description: string,
  help: string,
  target: string,
  recommendation: string
): AccessibilityViolation {
  const criteria: Record<string, string> = {
    "html-has-lang": "wcag311",
    "document-title": "wcag242",
    "image-alt": "wcag111",
    label: "wcag332",
    "link-name": "wcag244",
    "button-name": "wcag412",
    "heading-order": "wcag131",
  };
  return {
    id,
    impact,
    description,
    help,
    helpUrl: `https://dequeuniversity.com/rules/axe/4.10/${id}`,
    tags: ["wcag2a", criteria[id] ?? "wcag131"],
    nodes: [{ target }],
    recommendation,
  };
}

function collectStaticViolations(html: string): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) {
    violations.push(
      staticViolation(
        "html-has-lang",
        "serious",
        "The html element does not have a valid lang attribute.",
        "html element must have a lang attribute",
        "html",
        "Add a valid lang attribute to the html element matching the page's primary language."
      )
    );
  }
  if (!/<title\b[^>]*>[\s\S]*?\S[\s\S]*?<\/title>/i.test(html)) {
    violations.push(
      staticViolation(
        "document-title",
        "serious",
        "The document does not have a non-empty title.",
        "Documents must have a title",
        "title",
        "Add a concise, descriptive title element that identifies the page."
      )
    );
  }

  const imagePattern = /<img\b([^>]*)>/gi;
  let imageMatch: RegExpExecArray | null;
  while ((imageMatch = imagePattern.exec(html))) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(imageMatch[1])) {
      violations.push(
        staticViolation(
          "image-alt",
          "critical",
          "An image is missing an alt attribute.",
          "Images must have alternate text",
          "img",
          "Add meaningful alt text to informative images and use an empty alt attribute for decorative images."
        )
      );
    }
  }

  const controlPattern = /<(input|select|textarea)\b([^>]*)>/gi;
  let controlMatch: RegExpExecArray | null;
  while ((controlMatch = controlPattern.exec(html))) {
    const attrs = controlMatch[2];
    if (/\btype\s*=\s*["']hidden["']/i.test(attrs)) continue;
    const hasLabel = /\baria-label\s*=\s*["'][^"']+\S["']/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);
    const id = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    const hasFor = id ? new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${id}["']`, "i").test(html) : false;
    if (!hasLabel && !hasFor) {
      violations.push(
        staticViolation(
          "label",
          "critical",
          "A form control does not have an associated label.",
          "Form elements must have labels",
          controlMatch[1],
          "Associate every form control with a visible label using a label element or an accessible name."
        )
      );
    }
  }

  const emptyControlPattern = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let emptyControlMatch: RegExpExecArray | null;
  while ((emptyControlMatch = emptyControlPattern.exec(html))) {
    const attrs = emptyControlMatch[2];
    const content = emptyControlMatch[3].replace(/<[^>]+>/g, "").trim();
    if (!content && !/\baria-label\s*=\s*["'][^"']+\S["']/i.test(attrs)) {
      const id = emptyControlMatch[1] === "a" ? "link-name" : "button-name";
      const help =
        emptyControlMatch[1] === "a" ? "Links must have discernible names" : "Buttons must have discernible names";
      violations.push(
        staticViolation(
          id,
          "critical",
          `A ${emptyControlMatch[1]} does not have an accessible name.`,
          help,
          emptyControlMatch[1],
          emptyControlMatch[1] === "a"
            ? "Give every link a descriptive accessible name that explains its destination."
            : "Give every button a visible label or an accessible name describing its action."
        )
      );
    }
  }

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] - headings[index - 1] > 1) {
      violations.push(
        staticViolation(
          "heading-order",
          "moderate",
          "Heading levels are skipped in the document outline.",
          "Heading levels should only increase by one",
          `h${headings[index]}`,
          "Use heading levels in a logical sequence without skipping levels."
        )
      );
      break;
    }
  }
  return violations;
}

export function analyzeAccessibility(html: string, axeViolations?: AccessibilityViolation[]): AccessibilityAnalysis {
  const hasAxeResult = axeViolations !== undefined;
  const violations = hasAxeResult ? axeViolations : collectStaticViolations(html);
  const findings = violations.map(toFinding);
  const penalty = violations.reduce((total, violation) => total + impactPenalty(violation.impact), 0);
  return {
    score: Math.max(0, 100 - penalty),
    findings,
    violations,
    source: hasAxeResult ? "axe" : "static",
  };
}
