import { NextRequest, NextResponse } from "next/server";
import { getPublicScore } from "@/lib/score/publish";
import { renderBadge, type BadgeVariant } from "@/lib/score/badge";

export const dynamic = "force-dynamic";

function parseVariant(value: string | null): BadgeVariant {
  return value === "certified" ? "certified" : "score";
}

/**
 * Serves an embeddable SVG compliance badge for a published score.
 * `?variant=score` (default) → "Privacy Score N/100"; `?variant=certified`
 * → "Comply-Quick Certified". Returns 404 (as SVG) for unknown/revoked slugs.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const variant = parseVariant(request.nextUrl.searchParams.get("variant"));
  const published = await getPublicScore(slug);

  if (!published) {
    const svg = renderBadge("certified", 0).replace("Certified", "unavailable");
    return new NextResponse(svg, {
      status: 404,
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const svg = renderBadge(variant, published.score);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Short cache so a re-publish/revoke propagates quickly to embeds.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
