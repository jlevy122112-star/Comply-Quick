import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, readingTimeMinutes } from "@/lib/blog";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";
const SITE_ORIGIN = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

export const metadata: Metadata = {
  title: "Compliance Guides & Resources",
  description:
    "Practical GDPR, CCPA/CPRA, and privacy-policy guides for founders, agencies, and ecommerce stores — from the team behind Comply-Quick.",
  alternates: { canonical: `${SITE_ORIGIN}/blog`, languages: { "en-US": `${SITE_ORIGIN}/blog` } },
  openGraph: {
    type: "website",
    title: "Compliance Guides & Resources | Comply-Quick",
    description: "Practical GDPR, CCPA/CPRA, and privacy-policy guides for founders, agencies, and ecommerce stores.",
    url: `${SITE_ORIGIN}/blog`,
    images: [{ url: `${SITE_ORIGIN}/opengraph-image.png`, width: 1200, height: 630, alt: "Comply-Quick guides" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Compliance Guides & Resources | Comply-Quick",
    description: "Practical GDPR, CCPA/CPRA, and privacy-policy guides for founders, agencies, and ecommerce stores.",
    images: [`${SITE_ORIGIN}/opengraph-image.png`],
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          &larr; Comply-Quick
        </Link>
        <h1 className="mt-6 text-4xl font-bold text-white">Compliance Guides</h1>
        <p className="mt-3 max-w-2xl text-gray-400">
          Plain-English guides to GDPR, CCPA/CPRA, and privacy policies — what actually matters, and how to fix it fast.
        </p>

        <div className="mt-12 space-y-8">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-gray-800 pb-8">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-gray-300">{post.category}</span>
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span>· {readingTimeMinutes(post)} min read</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                <Link href={`/blog/${post.slug}`} className="hover:text-indigo-300">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-gray-400">{post.description}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300"
              >
                Read guide &rarr;
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
