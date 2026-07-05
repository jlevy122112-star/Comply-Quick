// Calendar — pure date/event helpers (Phase 9 / [Up7]).
//
// No network / DB / React here so it is fully unit-testable. These helpers do
// the calendar math: resolving a visible month grid, projecting the next due
// date for a weekly scan monitor, and bucketing a flat list of events by day.

/** Weekly re-scan cadence, kept in sync with the intelligence engine. */
export const SCAN_INTERVAL_DAYS = 7;

export type CalendarCategory = "task" | "renewal" | "scan" | "risk" | "regulation";
export type CalendarSeverity = "info" | "warning" | "critical";
export type CalendarStatus = "pending" | "done" | "dismissed";

export interface CalendarEvent {
  /** Stable id — a real task uuid, or a synthetic `<source>:<ref>` for derived events. */
  id: string;
  /** ISO date (YYYY-MM-DD) the event falls on, in UTC. */
  date: string;
  title: string;
  description: string;
  category: CalendarCategory;
  severity: CalendarSeverity;
  status: CalendarStatus;
  /** Manual/auto tasks are editable; derived events are read-only projections. */
  editable: boolean;
  /** Optional deep link to the originating feature (e.g. `/dashboard/home`). */
  href: string | null;
  /** Optional agency client this event belongs to. */
  agencyClientId: string | null;
}

/** Formats a Date as a UTC `YYYY-MM-DD` day key (calendar days are date-only). */
export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` (or ISO timestamp) into a UTC midnight Date. */
export function parseDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** Adds `days` to a UTC day, returning a new `YYYY-MM-DD` key. */
export function addDays(dayKey: string, days: number): string {
  const d = parseDay(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return toDayKey(d);
}

export interface MonthRange {
  /** First day of the month, `YYYY-MM-01`. */
  monthStart: string;
  /** First day of the next month (exclusive upper bound). */
  monthEnd: string;
  /** Sunday on/before monthStart — the first cell of a 6-week grid. */
  gridStart: string;
  /** Sunday after the last day — exclusive end of the 6-week grid. */
  gridEnd: string;
  year: number;
  /** 0-based month index (0 = January). */
  month: number;
}

/**
 * Resolves the calendar range for the month containing `ref`. `gridStart`/
 * `gridEnd` pad the month out to whole weeks (Sunday-first) so the UI can render
 * a stable 6×7 grid.
 */
export function monthRange(ref: Date): MonthRange {
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(end);
  // Advance to the Sunday strictly after the last day of the month.
  const trailing = (7 - gridEnd.getUTCDay()) % 7;
  gridEnd.setUTCDate(gridEnd.getUTCDate() + trailing);

  return {
    monthStart: toDayKey(start),
    monthEnd: toDayKey(end),
    gridStart: toDayKey(gridStart),
    gridEnd: toDayKey(gridEnd),
    year,
    month,
  };
}

/**
 * Projects when a weekly scan monitor is next due: `SCAN_INTERVAL_DAYS` after
 * its last scan, or — if it has never been scanned — its creation day (due now).
 * Returns a `YYYY-MM-DD` day key.
 */
export function nextScanDue(monitor: { lastScannedAt: string | null; createdAt: string }): string {
  if (!monitor.lastScannedAt) return toDayKey(parseDay(monitor.createdAt));
  return addDays(toDayKey(parseDay(monitor.lastScannedAt)), SCAN_INTERVAL_DAYS);
}

/** True when `dayKey` is within `[startInclusive, endExclusive)`. */
export function inRange(dayKey: string, startInclusive: string, endExclusive: string): boolean {
  return dayKey >= startInclusive && dayKey < endExclusive;
}

/**
 * Buckets events into a map keyed by day (`YYYY-MM-DD`). Within a day, events
 * are ordered most-severe first, then by title, for a stable render.
 */
export function bucketByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const severityRank: Record<CalendarSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.date) ?? [];
    list.push(ev);
    map.set(ev.date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title));
  }
  return map;
}
