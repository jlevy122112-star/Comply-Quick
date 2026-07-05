import { describe, it, expect } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/lib/calendar/ics";
import type { CalendarEvent } from "@/lib/calendar/events";

function ev(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "task-1",
    date: "2026-07-20",
    title: "Renew cookie-consent audit",
    description: "Annual review",
    category: "task",
    severity: "info",
    status: "pending",
    editable: true,
    href: "/dashboard/home",
    agencyClientId: null,
    ...overrides,
  };
}

const NOW = new Date("2026-07-05T00:00:00.000Z");

describe("escapeText", () => {
  it("escapes RFC 5545 special characters", () => {
    expect(escapeText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    expect(escapeText("line1\nline2")).toBe("line1\\nline2");
  });
});

describe("foldLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldLine("SUMMARY:hi")).toBe("SUMMARY:hi");
  });

  it("folds long lines to <=75 octets with CRLF + space continuation", () => {
    const long = "SUMMARY:" + "x".repeat(200);
    const folded = foldLine(long);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].length).toBe(75);
    for (const p of parts.slice(1)) expect(p.startsWith(" ")).toBe(true);
  });
});

describe("buildIcs", () => {
  it("wraps events in a VCALENDAR with required headers", () => {
    const ics = buildIcs([ev()], { now: NOW, appOrigin: "https://app.example.com" });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Comply-Quick//Compliance Calendar//EN");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("emits an all-day VEVENT with DTEND one day after DTSTART", () => {
    const ics = buildIcs([ev({ date: "2026-07-20" })], { now: NOW });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260720");
    expect(ics).toContain("DTEND;VALUE=DATE:20260721");
  });

  it("prefixes non-task categories in the summary and maps severity to priority", () => {
    const ics = buildIcs(
      [ev({ category: "renewal", title: "Subscription renews", severity: "critical", description: "" })],
      { now: NOW }
    );
    expect(ics).toContain("SUMMARY:[Renewal] Subscription renews");
    expect(ics).toContain("PRIORITY:1");
    expect(ics).toContain("CATEGORIES:RENEWAL");
  });

  it("does not prefix plain tasks", () => {
    const ics = buildIcs([ev({ category: "task", title: "Do thing" })], { now: NOW });
    expect(ics).toContain("SUMMARY:Do thing");
    expect(ics).not.toContain("[Task]");
  });

  it("builds a stable UID and absolute event URL from the app origin", () => {
    const ics = buildIcs([ev({ id: "scan:abc:2026-07-12", href: "/dashboard/home" })], {
      now: NOW,
      appOrigin: "https://app.example.com",
    });
    expect(ics).toContain("UID:scan-abc-2026-07-12@comply-quick");
    expect(ics).toContain("URL:https://app.example.com/dashboard/home");
  });

  it("escapes special characters in the summary", () => {
    const ics = buildIcs([ev({ title: "Audit, review; now", description: "" })], { now: NOW });
    expect(ics).toContain("SUMMARY:Audit\\, review\\; now");
  });
});
