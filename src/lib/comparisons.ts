// Competitor comparison content for high-intent SEO landing pages
// (/compare/[slug]). Each entry powers an indexable "Comply-Quick vs X" page
// targeting commercial-intent search queries. Claims are framed around
// Comply-Quick's scan-first, auto-implementation model; keep them accurate.

export interface ComparisonRow {
  feature: string;
  us: string;
  them: string;
}

export interface Comparison {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  keywords: string[];
  intro: string;
  rows: ComparisonRow[];
  faqs: { q: string; a: string }[];
}

const SHARED_ROWS: ComparisonRow[] = [
  {
    feature: "How documents are generated",
    us: "Scans your live tech stack and maps detected trackers to the exact required clauses",
    them: "Questionnaire / template fill-in with no awareness of your actual site",
  },
  {
    feature: "Regulation monitoring",
    us: "Monitors 26+ federal & state sources and auto-drafts updates for one-click approval",
    them: "Manual updates or basic change notices",
  },
  {
    feature: "Automated remediation",
    us: "Generates and applies an implementation strategy to regain compliance",
    them: "Not offered — you implement changes yourself",
  },
  {
    feature: "Developer liability shield",
    us: "Inward contract shield shifting liability from developer to merchant",
    them: "Not offered",
  },
  {
    feature: "Agency white-label",
    us: "Unlimited client sites, white-label exports, team roles",
    them: "Limited or add-on only",
  },
  {
    feature: "Embeddable trust badge",
    us: "Live compliance-score badge + public score page",
    them: "Not offered",
  },
];

export const COMPARISONS: Comparison[] = [
  {
    slug: "termly",
    competitor: "Termly",
    title: "Comply-Quick vs Termly: Scan-First Compliance Compared",
    description:
      "Compare Comply-Quick and Termly for website compliance. See how scan-first detection, regulation autopilot, and automated remediation stack up against template-based generators.",
    keywords: ["termly alternative", "termly vs", "privacy policy generator comparison", "termly competitor"],
    intro:
      "Termly is a popular template-based policy generator. Comply-Quick takes a different approach: it scans your live site, maps the tools you actually run to the clauses they require, and keeps you compliant automatically as regulations change.",
    rows: SHARED_ROWS,
    faqs: [
      {
        q: "Is Comply-Quick a good Termly alternative?",
        a: "Yes — if you want documents generated from your actual tech stack (not a questionnaire) plus automated regulation monitoring and remediation, Comply-Quick covers use cases Termly's template model does not.",
      },
      {
        q: "Does Comply-Quick cost more than Termly?",
        a: "Comply-Quick starts at $29/mo — and that plan already includes full Regulation Autopilot and monitoring. Compare that to a $2,000–$5,000 attorney review it can replace.",
      },
    ],
  },
  {
    slug: "iubenda",
    competitor: "iubenda",
    title: "Comply-Quick vs iubenda: Which Compliance Platform Fits You?",
    description:
      "Comply-Quick vs iubenda: compare scan-first document generation, automated regulation monitoring, developer liability shields, and agency white-label features.",
    keywords: ["iubenda alternative", "iubenda vs", "iubenda competitor", "website compliance software"],
    intro:
      "iubenda offers configurable legal documents and consent management. Comply-Quick adds scan-first detection, a developer-to-merchant liability shield, and automated remediation when the law changes.",
    rows: SHARED_ROWS,
    faqs: [
      {
        q: "Is Comply-Quick a good iubenda alternative?",
        a: "Comply-Quick is a strong fit for developers and agencies who want documents driven by a live scan of the site plus hands-off regulation monitoring and remediation.",
      },
      {
        q: "Does Comply-Quick support agencies?",
        a: "Yes — unlimited client sites, white-label exports, and team roles are built in, with recurring partner commissions available.",
      },
    ],
  },
  {
    slug: "termageddon",
    competitor: "Termageddon",
    title: "Comply-Quick vs Termageddon: Automated Compliance Compared",
    description:
      "Compare Comply-Quick and Termageddon for privacy policies and website compliance. See how scan-first detection and regulation autopilot compare to questionnaire-based policies.",
    keywords: ["termageddon alternative", "termageddon vs", "termageddon competitor", "auto-updating privacy policy"],
    intro:
      "Termageddon generates auto-updating policies from a questionnaire. Comply-Quick generates them from a live scan of your tech stack and can automatically implement the fixes needed to regain compliance.",
    rows: SHARED_ROWS,
    faqs: [
      {
        q: "Is Comply-Quick a good Termageddon alternative?",
        a: "If you want policies driven by what your site actually runs — plus automated remediation and a developer liability shield — Comply-Quick goes beyond questionnaire-based generation.",
      },
      {
        q: "How fast is a Comply-Quick scan?",
        a: "You get a compliance score and detected risks in seconds, with your full document package generated in under a minute.",
      },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
