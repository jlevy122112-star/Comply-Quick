"use client";

import Link from "next/link";
import { trackFreeScanStarted } from "@/components/analytics/OrganicFunnelTracker";

// Content → freemium funnel CTA. UTMs preserve campaign attribution across signup.
export function BlogCta({ campaign }: { campaign: string }) {
  const utm = `utm_source=blog&utm_medium=content&utm_campaign=${encodeURIComponent(campaign)}`;

  return (
    <aside className="mt-12 overflow-hidden rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/15 via-slate-950 to-slate-950 shadow-[0_24px_80px_-36px_rgba(99,102,241,0.65)]" aria-labelledby="scan-cta-heading">
      <div className="border-b border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">
        Complimentary compliance intelligence
      </div>
      <div className="p-6 sm:p-8">
        <h2 id="scan-cta-heading" className="text-2xl font-bold tracking-tight text-white">
          See the compliance gaps hiding on your site.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Comply-Quick renders your site in a real browser, detects trackers and compliance gaps, then maps them to the
          policies and implementation work needed to resolve them.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/dashboard?${utm}`}
            onClick={() => trackFreeScanStarted("blog", campaign)}
            className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            Run a free scan
          </Link>
          <Link
            href={`/?${utm}#pricing`}
            className="rounded-xl border border-slate-600 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            Explore plans
          </Link>
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-400">
          Built for agencies and software teams. Generated content is informational; obtain legal review where appropriate.
        </p>
      </div>
    </aside>
  );
}
