// [Up12] Blog helpers — pure, dependency-free lookups over BLOG_POSTS.

import { BLOG_POSTS, type BlogPost, type BlogBlock } from "./posts";

export type { BlogPost, BlogBlock };
export { BLOG_POSTS, BLOG_CATEGORIES } from "./posts";

/** Average adult reading speed used to estimate reading time. */
const WORDS_PER_MINUTE = 220;

function blockText(block: BlogBlock): string {
  switch (block.type) {
    case "ul":
    case "ol":
      return block.items.join(" ");
    default:
      return block.text;
  }
}

/** Estimated reading time in whole minutes (min 1). */
export function readingTimeMinutes(post: BlogPost): number {
  const words = post.body.map(blockText).join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** All posts, newest first. */
export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** Resolves a post's `related` slugs to posts, ignoring unknown/self refs. */
export function getRelatedPosts(post: BlogPost): BlogPost[] {
  return post.related
    .filter((s) => s !== post.slug)
    .map((s) => getPostBySlug(s))
    .filter((p): p is BlogPost => Boolean(p));
}
