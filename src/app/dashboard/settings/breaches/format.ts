import type { ObligationState } from "@/lib/privacy/breach";

export const STATE_STYLES: Record<ObligationState, string> = {
  met: "border-emerald-800/50 bg-emerald-950/40 text-emerald-300",
  upcoming: "border-sky-800/50 bg-sky-950/40 text-sky-300",
  due_soon: "border-amber-800/50 bg-amber-950/40 text-amber-300",
  overdue: "border-red-800/50 bg-red-950/40 text-red-300",
};

export const STATE_LABELS: Record<ObligationState, string> = {
  met: "Notified",
  upcoming: "Upcoming",
  due_soon: "Due Soon",
  overdue: "Overdue",
};

/** Formats an ISO timestamp for display in UTC, falling back to the raw value. */
export function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
}
