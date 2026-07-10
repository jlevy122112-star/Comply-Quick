import { parseDay, toDayKey, type CalendarEvent, type CalendarCategory } from "@/lib/calendar/events";

export interface CalendarMonthData {
  year: number;
  month: number;
  monthStart: string;
  gridStart: string;
  gridEnd: string;
  events: CalendarEvent[];
}

export interface ClientOption {
  id: string;
  name: string;
}

export type ViewMode = "month" | "week" | "agenda";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const CATEGORY_STYLE: Record<CalendarCategory, { label: string; dot: string; chip: string }> = {
  task: { label: "Task", dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  renewal: { label: "Renewal", dot: "bg-violet-400", chip: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  scan: { label: "Scan", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  risk: { label: "Risk alert", dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  regulation: { label: "Regulation", dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

// Deadline-heat tint applied to a day cell's background (level 0–3).
export const HEAT_BG = ["", "bg-sky-500/[0.04]", "bg-amber-500/[0.06]", "bg-rose-500/[0.08]"] as const;
export const HEAT_EDGE = [
  "",
  "",
  "shadow-[inset_2px_0_0_0_rgba(245,158,11,0.5)]",
  "shadow-[inset_2px_0_0_0_rgba(244,63,94,0.6)]",
] as const;

export function monthParam(dayKey: string, delta: number): string {
  const d = parseDay(dayKey);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function gridDays(gridStart: string, gridEnd: string): string[] {
  const days: string[] = [];
  let cursor = gridStart;
  while (cursor < gridEnd) {
    days.push(cursor);
    const d = parseDay(cursor);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = toDayKey(d);
  }
  return days;
}

/** Sunday-first week of 7 day keys containing `anchor`. */
export function weekDays(anchor: string): string[] {
  const d = parseDay(anchor);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const start = toDayKey(d);
  return Array.from({ length: 7 }, (_, i) => {
    const c = parseDay(start);
    c.setUTCDate(c.getUTCDate() + i);
    return toDayKey(c);
  });
}

export function longDate(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
