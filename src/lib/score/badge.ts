// Embeddable SVG badge generator (Phase 4 / [Up4]).
//
// Pure string builders for the two shield-style badges a user can embed:
//   • "score"     → "Privacy Score  87/100"
//   • "certified" → "Comply-Quick  Certified"
// No DOM/network — safe to unit test and to render from an edge route.

export type BadgeVariant = "score" | "certified";

const COLORS = { green: "#16a34a", amber: "#d97706", red: "#dc2626", brand: "#4f46e5", label: "#334155" } as const;

/** Score band → badge accent color (matches the dashboard score coloring). */
function scoreColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.amber;
  return COLORS.red;
}

/** Approx width of a text run at the badge's 11px font (monospace-ish estimate). */
function textWidth(text: string): number {
  return text.length * 6.5 + 20;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Builds a two-segment "shields.io"-style SVG badge. The left segment is a dark
 * label; the right segment is the colored value.
 */
export function renderBadge(variant: BadgeVariant, score: number): string {
  const label = variant === "certified" ? "Comply-Quick" : "Privacy Score";
  const value = variant === "certified" ? "Certified" : `${score}/100`;
  const valueColor = variant === "certified" ? COLORS.brand : scoreColor(score);

  const lw = Math.round(textWidth(label));
  const vw = Math.round(textWidth(value));
  const w = lw + vw;
  const h = 20;

  const l = escapeXml(label);
  const v = escapeXml(value);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="${l}: ${v}">
  <rect width="${w}" height="${h}" rx="3" fill="${COLORS.label}"/>
  <rect x="${lw}" width="${vw}" height="${h}" rx="3" fill="${valueColor}"/>
  <rect x="${lw}" width="4" height="${h}" fill="${valueColor}"/>
  <g fill="#ffffff" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14" text-anchor="middle">${l}</text>
    <text x="${lw + vw / 2}" y="14" text-anchor="middle">${v}</text>
  </g>
</svg>`;
}
