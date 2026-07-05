import { describe, it, expect } from "vitest";
import { getAllPosts, getPostBySlug, getRelatedPosts, readingTimeMinutes, BLOG_POSTS } from "@/lib/blog";

describe("blog posts", () => {
  it("ships the three named articles with unique slugs", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("gdpr-compliance-checklist-shopify-stores");
    expect(slugs).toContain("hidden-js-trackers-ccpa-fines");
    expect(slugs).toContain("privacy-policy-template-saas-founders");
  });

  it("sorts getAllPosts newest first", () => {
    const dates = getAllPosts().map((p) => p.publishedAt);
    const sorted = [...dates].sort((a, b) => (a < b ? 1 : -1));
    expect(dates).toEqual(sorted);
  });

  it("estimates a positive reading time for every post", () => {
    for (const p of BLOG_POSTS) expect(readingTimeMinutes(p)).toBeGreaterThan(0);
  });

  it("resolves related posts to real, non-self posts", () => {
    for (const p of BLOG_POSTS) {
      const related = getRelatedPosts(p);
      expect(related.length).toBe(p.related.filter((s) => s !== p.slug).length);
      for (const r of related) expect(r.slug).not.toBe(p.slug);
    }
  });

  it("has no broken internal /blog links in body copy", () => {
    const linkRe = /\]\((\/blog\/[a-z0-9-]+)\)/g;
    for (const p of BLOG_POSTS) {
      const text = p.body.map((b) => ("items" in b ? b.items.join(" ") : b.text)).join(" ");
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(text)) !== null) {
        const slug = m[1].replace("/blog/", "");
        expect(getPostBySlug(slug), `broken internal link to ${m[1]} in ${p.slug}`).toBeDefined();
      }
    }
  });

  it("requires SEO metadata on every post", () => {
    for (const p of BLOG_POSTS) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(50);
      expect(p.keywords.length).toBeGreaterThan(0);
    }
  });
});
