import { cn } from "./cn";

export type ProgressTone = "indigo" | "emerald" | "amber" | "rose";

const TONE_FILL: Record<ProgressTone, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

/** Picks a tone from a 0–100 value (red → amber → green) unless overridden. */
export function toneForScore(value: number): ProgressTone {
  if (value >= 80) return "emerald";
  if (value >= 50) return "amber";
  return "rose";
}

export interface ProgressBarProps {
  /** Current value. */
  value: number;
  /** Maximum value (defaults to 100). */
  max?: number;
  tone?: ProgressTone;
  /** Optional label rendered above the track. */
  label?: string;
  /** Show the numeric "value/max" (or percent) on the right of the label. */
  showValue?: boolean;
  /** Render the value as a percentage rather than raw "value/max". */
  asPercent?: boolean;
  /** Accessible label for the progressbar element. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Accessible progress/meter bar. Drives the compliance-coverage meter, onboarding
 * completion, and multi-step tool generation indicators across the dashboard.
 */
export function ProgressBar({
  value,
  max = 100,
  tone,
  label,
  showValue = false,
  asPercent = true,
  ariaLabel,
  className,
}: ProgressBarProps) {
  const safeMax = max <= 0 ? 100 : max;
  const clamped = Math.max(0, Math.min(value, safeMax));
  const pct = Math.round((clamped / safeMax) * 100);
  const resolvedTone = tone ?? toneForScore(pct);
  const valueText = asPercent ? `${pct}%` : `${clamped}/${safeMax}`;

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && <span className="text-xs font-medium text-gray-300">{label}</span>}
          {showValue && <span className="text-xs font-semibold text-gray-200 tabular-nums">{valueText}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={ariaLabel ?? label ?? "progress"}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-800"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", TONE_FILL[resolvedTone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
