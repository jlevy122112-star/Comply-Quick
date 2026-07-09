// Calendar insights — pure summarisation of a month's events into the metrics
// that power the flagship Calendar's KPI gauges, deadline heatmap, and guided
// "next action" card. No DB/React/network here so it is fully unit-testable and
// deterministic (given the same events + reference day it always yields the same
// summary).

import type { CalendarEvent, CalendarCategory, CalendarSeverity } from "./events";

export interface CalendarSummary {
  total: number;
  /** Pending (not done/dismissed) events whose date is before today. */
  overdue: number;
  /** Pending events due exactly today. */
  dueToday: number;
  /** Pending events due within the next 7 days (today inclusive). */
  next7: number;
  completed: number;
  /** 0–100: completed / (completed + still-actionable), rounded. 100 when empty. */
  completionRate: number;
  /** 0–100 "on track" health: starts at 100, penalised by overdue + near-term load. */
  onTrack: number;
  byCategory: Record<CalendarCategory, number>;
}

const ACTIONABLE = (e: CalendarEvent) => e.status !== "done" && e.status !== "dismissed";

function emptyByCategory(): Record<CalendarCategory, number> {
  return { task: 0, renewal: 0, scan: 0, risk: 0, regulation: 0 };
}

/** Summarises events relative to `todayKey` (YYYY-MM-DD, UTC). */
export function summarizeEvents(events: CalendarEvent[], todayKey: string): CalendarSummary {
  const byCategory = emptyByCategory();
  let overdue = 0;
  let dueToday = 0;
  let next7 = 0;
  let completed = 0;

  const in7 = addDaysKey(todayKey, 7);

  for (const e of events) {
    byCategory[e.category] += 1;
    if (e.status === "done") {
      completed += 1;
      continue;
    }
    if (!ACTIONABLE(e)) continue;
    if (e.date < todayKey) overdue += 1;
    else if (e.date === todayKey) {
      dueToday += 1;
      next7 += 1;
    } else if (e.date < in7) next7 += 1;
  }

  const actionable = events.filter(ACTIONABLE).length;
  const denom = completed + actionable;
  const completionRate = denom === 0 ? 100 : Math.round((completed / denom) * 100);

  // Health: each overdue item is a hard hit; near-term load applies gentle drag.
  const onTrack = Math.max(0, Math.min(100, 100 - overdue * 15 - Math.max(0, next7 - 3) * 4));

  return {
    total: events.length,
    overdue,
    dueToday,
    next7,
    completed,
    completionRate,
    onTrack,
    byCategory,
  };
}

/** Deadline-heat level (0–3) for a single day, from event count + severity. */
export function heatLevel(dayEvents: CalendarEvent[]): 0 | 1 | 2 | 3 {
  if (dayEvents.length === 0) return 0;
  const hasCritical = dayEvents.some((e) => e.severity === "critical" && e.status !== "done");
  const active = dayEvents.filter(ACTIONABLE).length;
  if (hasCritical || active >= 4) return 3;
  if (active >= 2) return 2;
  if (active >= 1) return 1;
  return 0;
}

export interface NextAction {
  event: CalendarEvent;
  /** Whole days from today; negative = overdue. */
  daysUntil: number;
  overdue: boolean;
}

const SEVERITY_RANK: Record<CalendarSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Picks the single most urgent actionable event to guide the user: overdue
 * items first (oldest first), otherwise the soonest upcoming; severity breaks
 * ties. Returns null when nothing is actionable.
 */
export function nextAction(events: CalendarEvent[], todayKey: string): NextAction | null {
  const actionable = events.filter(ACTIONABLE);
  if (actionable.length === 0) return null;

  const sorted = [...actionable].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  });

  // Prefer the earliest overdue/soonest; the sort already front-loads by date.
  const event = sorted[0];
  const daysUntil = daysBetween(todayKey, event.date);
  return { event, daysUntil, overdue: daysUntil < 0 };
}

function addDaysKey(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = Date.parse(`${fromKey}T00:00:00.000Z`);
  const b = Date.parse(`${toKey}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}
