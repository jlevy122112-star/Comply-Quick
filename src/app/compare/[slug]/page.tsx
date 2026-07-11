import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPARISONS, getComparison } from "@/lib/comparisons";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";
const START_HREF = "/dashboard?utm_source=landing&utm_medium=compare&utm_campaign=free_scan";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) return { title: "Not found" };
  const url = `${BASE_URL}/compare/${c.slug}`;
  return {
    title: c.title,
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: url },
    openGraph: { type: "article", title: c.title, description: c.description, url },
    twitter: { card: "summary_large_image", title: c.title, description: c.description },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) notFound();

  const url = `${BASE_URL}/compare/${c.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
    url,
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <nav className="text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-200">
            Home
          </Link>{" "}
          / <span className="text-gray-300">Compare</span> / <span className="text-gray-200">{c.competitor}</span>
        </nav>

        <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-white leading-tight">Comply-Quick vs {c.competitor}</h1>
        <p className="mt-5 text-base sm:text-lg text-gray-200 leading-relaxed">{c.intro}</p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            href={START_HREF}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors text-center"
          >
            Scan your site free
          </Link>
          <Link
            href="/#pricing"
            className="px-6 py-3 rounded-xl border border-gray-700 text-gray-200 font-medium hover:border-gray-500 hover:text-white transition-colors text-center"
          >
            View pricing
          </Link>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="px-4 py-3 font-semibold text-gray-300">Feature</th>
                <th className="px-4 py-3 font-semibold text-indigo-300">Comply-Quick</th>
                <th className="px-4 py-3 font-semibold text-gray-300">{c.competitor}</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.feature} className="border-b border-gray-800/60 last:border-0">
                  <td className="px-4 py-4 align-top font-medium text-white">{row.feature}</td>
                  <td className="px-4 py-4 align-top text-gray-200">{row.us}</td>
                  <td className="px-4 py-4 align-top text-gray-400">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-white">Frequently asked questions</h2>
          <div className="mt-6 space-y-4">
            {c.faqs.map((f) => (
              <details
                key={f.q}
                className="group bg-gray-900 border border-gray-800 rounded-2xl p-5 [&_summary]:list-none"
              >
                <summary className="flex items-center justify-between cursor-pointer text-white font-medium">
                  <span>{f.q}</span>
                  <span className="ml-4 text-gray-500 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-300 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-14 text-center">
          <p className="text-sm text-gray-300">Other comparisons:</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            {COMPARISONS.filter((o) => o.slug !== c.slug).map((o) => (
              <Link
                key={o.slug}
                href={`/compare/${o.slug}`}
                className="text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                vs {o.competitor}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-gray-500">
          Comparison reflects Comply-Quick&apos;s capabilities and publicly available information about {c.competitor}.
          This is not legal advice.
        </p>
      </div>
    </main>
  );
}
