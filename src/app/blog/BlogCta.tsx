import Link from "next/link";

// Content → freemium → paid funnel CTA ([Up12]). Links carry UTM params so the
// blog-sourced signups/scans are attributable in analytics.
export function BlogCta({ campaign }: { campaign: string }) {
  const utm = `utm_source=blog&utm_medium=content&utm_campaign=${encodeURIComponent(campaign)}`;
  return (
    <aside className="mt-12 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-gray-900 p-6">
      <h2 className="text-xl font-bold text-white">Scan Your Site for Free</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        Comply-Quick renders your site in a real browser, flags hidden trackers and compliance gaps, and generates the
        policies and checklists to fix them — in about 30 seconds.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/dashboard?${utm}`}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Run a free scan
        </Link>
        <Link
          href={`/?${utm}#pricing`}
          className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-200 hover:border-gray-500"
        >
          See pricing
        </Link>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Generated content is informational only. Consult a legal professional before deployment.
      </p>
    </aside>
  );
}
