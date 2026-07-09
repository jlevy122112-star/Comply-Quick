import type { ReactNode } from "react";
import { cn } from "./cn";
import type { BadgeTone } from "./Badge";

export interface ActivityItem {
  id: string;
  title: ReactNode;
  detail?: ReactNode;
  /** ISO timestamp; rendered as an absolute, locale-aware date/time. */
  timestamp: string;
  tone?: BadgeTone;
  icon?: ReactNode;
}

const DOT: Record<BadgeTone, string> = {
  rose: "bg-rose-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
  indigo: "bg-indigo-400",
  violet: "bg-violet-400",
  gray: "bg-gray-500",
};

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Vertical audit-style timeline. Every entry carries a timestamp so activity is
 * reviewable/auditable — a core enterprise-trust requirement.
 */
export function ActivityFeed({ items, className }: { items: ActivityItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-5 pl-6", className)}>
      <span className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-800" aria-hidden />
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute -left-6 top-1 h-3.5 w-3.5 rounded-full ring-4 ring-gray-950",
              DOT[item.tone ?? "gray"]
            )}
            aria-hidden
          />
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-white">
              {item.icon && <span className="mr-1.5">{item.icon}</span>}
              {item.title}
            </p>
            <time className="shrink-0 text-xs tabular-nums text-gray-500" dateTime={item.timestamp}>
              {formatTs(item.timestamp)}
            </time>
          </div>
          {item.detail && <p className="mt-0.5 text-sm text-gray-400">{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
