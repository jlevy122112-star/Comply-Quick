import type { CSSProperties } from "react";
import { cn } from "./cn";

type Size = "sm" | "md" | "lg";

const DIMS: Record<Size, { px: number; stroke: number; text: string; sub: string }> = {
  sm: { px: 64, stroke: 6, text: "text-base", sub: "text-[10px]" },
  md: { px: 96, stroke: 8, text: "text-2xl", sub: "text-xs" },
  lg: { px: 128, stroke: 10, text: "text-4xl", sub: "text-xs" },
};

/** Tailwind stroke colours by score band — matches the app's tone scale. */
function ring(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-rose-400";
}

/**
 * Circular compliance-score gauge. Deterministic SVG (no client JS) so it renders
 * on the server and stays crisp at any size.
 */
export function ScoreRing({
  score,
  size = "md",
  label = "score",
  tone = "default",
  className,
}: {
  score: number;
  size?: Size;
  label?: string;
  tone?: "default" | "surface";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const { px, stroke, text, sub } = DIMS[size];
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: px, height: px }}
    >
      <svg width={px} height={px} className="-rotate-90" role="img" aria-label={`${clamped} out of 100 ${label}`}>
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={tone === "surface" ? "text-border-default" : "text-gray-800"}
          stroke="currentColor"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={cn(ring(clamped), "animate-progress-sweep transition-[stroke-dasharray] duration-700 ease-out")}
          stroke="currentColor"
          style={
            {
              "--score-dash": dash,
              "--score-circumference": circumference,
            } as CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-semibold tabular-nums", tone === "surface" ? "text-text-primary" : "text-white", text)}
        >
          {clamped}
        </span>
        <span className={cn("uppercase tracking-wide", tone === "surface" ? "text-text-muted" : "text-gray-500", sub)}>
          {label}
        </span>
      </div>
    </div>
  );
}
