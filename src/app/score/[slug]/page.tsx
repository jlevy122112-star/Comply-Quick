import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublicScore } from "@/lib/score/publish";

export const dynamic = "force-dynamic";

function scoreColor(score: number): string {
  return score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
}

function scoreBand(score: number): string {
  return score >= 80
    ? "Strong compliance posture"
    : score >= 60
      ? "Moderate — improvements recommended"
      : "At risk — action needed";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const published = await getPublicScore(slug);
  if (!published) return { title: "Score not found — Comply-Quick" };
  const title = `Privacy Score: ${published.score}/100 — Comply-Quick`;
  return { title, description: `${published.label ?? published.url} scored ${published.score}/100 on Comply-Quick.` };
}

/**
 * Public, unauthenticated compliance-score page. Anyone with the slug can view
 * the published snapshot; the score/url are read from `published_scores`, never
 * the live scan.
 */
export default async function PublicScorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const published = await getPublicScore(slug);
  if (!published) notFound();

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500">Comply-Quick verified score</p>
        <h1 className="mt-2 text-lg font-semibold text-white break-all">{published.label ?? published.url}</h1>

        <div className={`mt-6 text-6xl font-bold ${scoreColor(published.score)}`}>{published.score}</div>
        <p className="mt-1 text-sm text-gray-400">out of 100</p>
        <p className="mt-3 text-sm font-medium text-gray-300">{scoreBand(published.score)}</p>

        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic SVG badge from an API route, not a static asset */}
        <img
          src={`/api/badge/${published.slug}?variant=certified`}
          alt="Comply-Quick Certified badge"
          className="mx-auto mt-6"
          height={20}
        />

        <div className="mt-8 border-t border-gray-800 pt-6">
          <p className="text-xs text-gray-500">Want a compliance score for your own site?</p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Scan your site free →
          </Link>
        </div>
      </div>
      <p className="mt-6 text-xs text-gray-600">Published {new Date(published.createdAt).toLocaleDateString()}</p>
    </main>
  );
}
