// Calendar — ICS (RFC 5545) serializer for one-way calendar linking ([Up7]).
//
// Pure, testable text generation only (no DB / network / React). Turns a flat
// list of CalendarEvents into an iCalendar document that Google / Outlook /
// Apple Calendar can subscribe to. Events are all-day (DATE value type) since
// compliance items are date-only. The feed is one-way: our events are projected
// into the subscriber's calendar; nothing is read back.

import type { CalendarEvent } from "./events";
import { parseDay, toDayKey } from "./events";

/** Product identifier advertised in the feed. */
const PRODID = "-//Comply-Quick//Compliance Calendar//EN";

/** Escapes a TEXT value per RFC 5545 §3.3.11 (backslash, comma, semicolon, newlines). */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to <=75 octets with CRLF + single-space continuation. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** `YYYY-MM-DD` → `YYYYMMDD` for DATE values. */
function toIcsDate(dayKey: string): string {
  return dayKey.replace(/-/g, "");
}

/** UTC timestamp → `YYYYMMDDTHHMMSSZ` for DTSTAMP / UID stability. */
function toIcsStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

const CATEGORY_LABEL: Record<CalendarEvent["category"], string> = {
  task: "Task",
  renewal: "Renewal",
  scan: "Scan",
  risk: "Risk alert",
  regulation: "Regulation",
};

/** Serializes a single event to a VEVENT block (unfolded lines joined later). */
function serializeEvent(ev: CalendarEvent, stamp: string, appOrigin: string): string[] {
  const start = toIcsDate(ev.date);
  // All-day events are half-open: DTEND is the day after DTSTART.
  const end = toIcsDate(addOneDay(ev.date));
  // Stable, globally-unique UID so re-subscribing updates rather than duplicates.
  const uid = `${ev.id.replace(/[^A-Za-z0-9_-]/g, "-")}@comply-quick`;
  const summaryPrefix = ev.category === "task" ? "" : `[${CATEGORY_LABEL[ev.category]}] `;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeText(summaryPrefix + ev.title)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
  lines.push(`CATEGORIES:${escapeText(CATEGORY_LABEL[ev.category].toUpperCase())}`);
  if (ev.href) lines.push(`URL:${escapeText(appOrigin.replace(/\/$/, "") + ev.href)}`);
  // Map compliance severity → iCalendar priority (1 highest, 9 lowest).
  const priority = ev.severity === "critical" ? 1 : ev.severity === "warning" ? 5 : 9;
  lines.push(`PRIORITY:${priority}`);
  lines.push("END:VEVENT");
  return lines;
}

function addOneDay(dayKey: string): string {
  const d = parseDay(dayKey);
  d.setUTCDate(d.getUTCDate() + 1);
  return toDayKey(d);
}

export interface BuildIcsOptions {
  /** Calendar display name (X-WR-CALNAME). */
  name?: string;
  /** Absolute origin used to build event URLs (e.g. https://app.example.com). */
  appOrigin?: string;
  /** Timestamp used for DTSTAMP (defaults to now); injectable for tests. */
  now?: Date;
}

/**
 * Builds a complete VCALENDAR document from a list of events. Output uses CRLF
 * line endings and RFC 5545 line folding so it validates in Google/Outlook/Apple.
 */
export function buildIcs(events: CalendarEvent[], opts: BuildIcsOptions = {}): string {
  const name = opts.name ?? "Comply-Quick Compliance";
  const appOrigin = opts.appOrigin ?? "";
  const stamp = toIcsStamp(opts.now ?? new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-PUBLISHED-TTL:PT12H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
  ];
  for (const ev of events) lines.push(...serializeEvent(ev, stamp, appOrigin));
  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
