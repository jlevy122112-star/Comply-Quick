import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal Center — Comply-Quick",
  description: "Central legal and compliance documentation for Comply-Quick users, agencies, and enterprise teams.",
};

const LEGAL_DOCS = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    body: "Platform terms, liability boundaries, and customer responsibilities.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    body: "Data processing, rights requests, retention, and security practices.",
  },
  {
    href: "/legal/cookies",
    title: "Cookie Notice",
    body: "Cookie categories, consent controls, and signal handling guidance.",
  },
  {
    href: "/legal/subscription",
    title: "Subscription & Cancellation",
    body: "Billing, renewals, cancellation workflow, and refund policy details.",
  },
  {
    href: "/legal/security",
    title: "Security Policy",
    body: "Security controls, incident response, and vulnerability reporting process.",
  },
  {
    href: "/legal/dpa",
    title: "Data Processing Addendum Summary",
    body: "Controller/processor terms, subprocessor governance, and transfer safeguards.",
  },
  {
    href: "/legal/subprocessors",
    title: "Subprocessor Transparency",
    body: "Categories of subprocessors and notice commitments for changes.",
  },
  {
    href: "/legal/acceptable-use",
    title: "Acceptable Use Policy",
    body: "Prohibited activities and platform integrity requirements.",
  },
  {
    href: "/legal/sla",
    title: "Support SLA",
    body: "Response-time targets, support channels, and escalation pathway.",
  },
  {
    href: "/legal/accessibility",
    title: "Accessibility Statement",
    body: "Accessibility commitments, standards alignment, and support channels.",
  },
  {
    href: "/legal/notices",
    title: "Legal Notices",
    body: "Regulatory notices, jurisdiction coverage, and legal contact details.",
  },
  {
    href: "/legal/packet",
    title: "Counsel Review Packet",
    body: "Formal white-label packet index for legal counsel review and sign-off.",
  },
];

export default function LegalCenterPage() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-12 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-gray-800 bg-gradient-to-br from-indigo-500/10 via-gray-900 to-gray-950 px-6 py-10 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Comply-Quick Legal</p>
          <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Legal and Compliance Center</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-300 sm:text-base">
            Enterprise-grade legal documentation for customers, partners, and auditors. For legal requests or security
            disclosures, contact support@comply-quick.com.
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEGAL_DOCS.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 transition-all hover:border-indigo-500/50 hover:bg-gray-900"
            >
              <h2 className="text-base font-semibold text-white">{doc.title}</h2>
              <p className="mt-2 text-sm text-gray-300">{doc.body}</p>
              <span className="mt-4 inline-block text-xs font-medium uppercase tracking-wider text-indigo-300">
                Open document
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
