import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Counsel Review Packet — Comply-Quick",
  description: "White-label legal and compliance packet index for professional legal counsel review.",
};

const PACKET_SECTIONS = [
  "External Legal Documents",
  "Internal Compliance Policies",
  "Operational Runbooks and Evidence Logs",
  "Regulatory Requirement Matrix",
  "Open Risks and Counsel Review Notes",
  "Approval/Denial Signature Record",
];

export default function CounselReviewPacketPage() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-12 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-gray-800 bg-gradient-to-b from-indigo-500/10 via-gray-900 to-gray-950 p-6 shadow-2xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">White-Label Packet</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Comply-Quick Legal & Compliance Counsel Packet
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-gray-300 sm:text-base">
          This packet is structured for formal legal-team review and sign-off. It includes internal and external legal
          documentation, compliance controls, and operational evidence templates.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Packet Components</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            {PACKET_SECTIONS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-indigo-300">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/legal"
            className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 hover:border-indigo-500/50"
          >
            <h3 className="text-base font-semibold text-white">External Legal Center</h3>
            <p className="mt-2 text-sm text-gray-300">Public-facing legal documents for customers and partners.</p>
          </Link>
          <Link
            href="/dashboard/compliance-hq"
            className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 hover:border-indigo-500/50"
          >
            <h3 className="text-base font-semibold text-white">Internal Compliance HQ</h3>
            <p className="mt-2 text-sm text-gray-300">Internal policies, runbooks, and operations logs.</p>
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Legal counsel must review and approve final legal text before production reliance.
        </div>
      </div>
    </main>
  );
}
