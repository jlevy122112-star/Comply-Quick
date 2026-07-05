import type { Metadata } from "next";
import Link from "next/link";
import { TERMS_OF_SERVICE, TERMS_EFFECTIVE_DATE, TERMS_VERSION, REPORT_DISCLAIMER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Comply-Quick",
  description:
    "Comply-Quick Terms of Service, including the limitation of liability and client responsibilities for generated compliance content.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          &larr; Back to Comply-Quick
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">
          Version {TERMS_VERSION} · Effective {TERMS_EFFECTIVE_DATE}
        </p>

        <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-200">{REPORT_DISCLAIMER}</p>
        </div>

        <div className="mt-10 space-y-8">
          {TERMS_OF_SERVICE.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-white">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-gray-300">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 border-t border-gray-800 pt-6 text-xs text-gray-500">
          By using Comply-Quick you agree to these Terms. Questions? Contact your account owner.
        </footer>
      </div>
    </main>
  );
}
