import { Badge, type BadgeTone } from "./Badge";

/** Finding severities + generic risk levels, mapped to one consistent scale. */
export type Severity = "critical" | "high" | "warning" | "medium" | "info" | "low";

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  critical: "rose",
  high: "rose",
  warning: "amber",
  medium: "amber",
  info: "sky",
  low: "sky",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  warning: "Warning",
  medium: "Medium",
  info: "Info",
  low: "Low",
};

const DOT: Record<BadgeTone, string> = {
  rose: "bg-rose-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
  indigo: "bg-indigo-400",
  violet: "bg-violet-400",
  gray: "bg-gray-400",
};

/** A colour-coded severity/risk pill used across findings, scans, and alerts. */
export function SeverityPill({ severity, className }: { severity: Severity; className?: string }) {
  const tone = SEVERITY_TONE[severity];
  return (
    <Badge tone={tone} className={className}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}
