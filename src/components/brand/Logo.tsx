import Image from "next/image";
import Link from "next/link";

type Tone = "light" | "dark";
type Size = "sm" | "md" | "lg";

const MARK_PX: Record<Size, number> = { sm: 24, md: 32, lg: 44 };
const WORDMARK_CLS: Record<Size, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

export interface LogoProps {
  /** Wordmark color context. "dark" = for dark backgrounds (white text). */
  tone?: Tone;
  size?: Size;
  /** Render just the mark, no wordmark. */
  markOnly?: boolean;
  /** Wrap in a link to this href. */
  href?: string;
  className?: string;
  /** Optional tagline under the wordmark. */
  tagline?: boolean;
}

/**
 * Comply-Quick brand lockup: the gradient shield mark + the "Comply-Quick"
 * wordmark. The mark is a shipped raster asset; the wordmark is live text so it
 * stays crisp and adapts to light/dark backgrounds. Use this for Comply-Quick's
 * own surfaces (marketing, app chrome, auth, transactional email is separate).
 * For agency/white-label deliverables use the agency's own branding instead.
 */
export function Logo({
  tone = "dark",
  size = "md",
  markOnly = false,
  href,
  className = "",
  tagline = false,
}: LogoProps) {
  const px = MARK_PX[size];
  const wordColor = tone === "dark" ? "text-white" : "text-gray-900";
  const tagColor = tone === "dark" ? "text-gray-400" : "text-gray-500";

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/brand/mark.png"
        alt="Comply-Quick"
        width={px}
        height={px}
        priority
        className="shrink-0"
        style={{ height: px, width: "auto" }}
      />
      {!markOnly && (
        <span className="inline-flex flex-col leading-none">
          <span className={`font-bold tracking-tight ${wordColor} ${WORDMARK_CLS[size]}`}>Comply-Quick</span>
          {tagline && (
            <span className={`mt-1 text-[10px] font-medium uppercase tracking-[0.18em] ${tagColor}`}>
              Compliance Automation
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="Comply-Quick" className="inline-flex">
        {content}
      </Link>
    );
  }
  return content;
}
