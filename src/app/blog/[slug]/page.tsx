import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, getRelatedPosts, readingTimeMinutes } from "@/lib/blog";
import { BlogBody } from "../render";
import { BlogCta } from "../BlogCta";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not found" };
  const url = `${BASE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);
  const url = `${BASE_URL}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "Comply-Quick" },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.keywords.join(", "),
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <nav className="text-sm text-gray-500">
          <Link href="/blog" className="hover:text-gray-300">
            &larr; All guides
          </Link>
        </nav>

        <div className="mt-6 flex items-center gap-3 text-xs text-gray-500">
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

        <h1 className="mt-3 text-4xl font-bold leading-tight text-white">{post.title}</h1>
        <p className="mt-4 text-lg text-gray-400">{post.description}</p>

        <div className="mt-10">
          <BlogBody body={post.body} />
        </div>

        <BlogCta campaign={post.slug} />

        {related.length > 0 && (
          <section className="mt-12 border-t border-gray-800 pt-8">
            <h2 className="text-lg font-semibold text-white">Related guides</h2>
            <ul className="mt-4 space-y-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`} className="text-indigo-400 hover:text-indigo-300">
                    {r.title}
                  </Link>
                  <p className="text-sm text-gray-500">{r.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
