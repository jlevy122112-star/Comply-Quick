import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { COMPARISONS } from "@/lib/comparisons";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";
const SITE_ORIGIN = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts().map((p) => ({
    url: `${SITE_ORIGIN}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const comparisons = COMPARISONS.map((c) => ({
    url: `${SITE_ORIGIN}/compare/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: SITE_ORIGIN,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_ORIGIN}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_ORIGIN}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...comparisons,
    ...posts,
  ];
}
