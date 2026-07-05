import { describe, it, expect } from "vitest";
import {
  monthRange,
  nextScanDue,
  addDays,
  toDayKey,
  inRange,
  bucketByDay,
  SCAN_INTERVAL_DAYS,
  type CalendarEvent,
} from "@/lib/calendar/events";

function event(partial: Partial<CalendarEvent> & { id: string; date: string }): CalendarEvent {
  return {
    title: partial.title ?? partial.id,
    description: "",
    category: "task",
    severity: "info",
    status: "pending",
    editable: true,
    href: null,
    agencyClientId: null,
    ...partial,
  };
}

describe("monthRange", () => {
  it("resolves month bounds and pads to whole Sunday-first weeks", () => {
    // July 2026: 1st is a Wednesday, 31st is a Friday.
    const r = monthRange(new Date("2026-07-15T12:00:00Z"));
    expect(r.year).toBe(2026);
    expect(r.month).toBe(6); // 0-based
    expect(r.monthStart).toBe("2026-07-01");
    expect(r.monthEnd).toBe("2026-08-01");
    // Grid starts on the Sunday on/before Jul 1 (Sun Jun 28) and ends on the
    // Sunday after Jul 31 (Sun Aug 2).
    expect(r.gridStart).toBe("2026-06-28");
    expect(r.gridEnd).toBe("2026-08-02");
    expect(new Date(r.gridStart + "T00:00:00Z").getUTCDay()).toBe(0);
    expect(new Date(r.gridEnd + "T00:00:00Z").getUTCDay()).toBe(0);
  });

  it("keeps gridStart at monthStart when the 1st is already a Sunday", () => {
    // Feb 2026: the 1st is a Sunday.
    const r = monthRange(new Date("2026-02-10T00:00:00Z"));
    expect(r.monthStart).toBe("2026-02-01");
    expect(r.gridStart).toBe("2026-02-01");
  });
});

describe("nextScanDue", () => {
  it("projects SCAN_INTERVAL_DAYS after the last scan", () => {
    const due = nextScanDue({ lastScannedAt: "2026-07-01T09:00:00Z", createdAt: "2026-06-01T00:00:00Z" });
    expect(due).toBe(addDays("2026-07-01", SCAN_INTERVAL_DAYS));
    expect(due).toBe("2026-07-08");
  });

  it("falls back to the creation day when never scanned", () => {
    const due = nextScanDue({ lastScannedAt: null, createdAt: "2026-06-20T10:00:00Z" });
    expect(due).toBe("2026-06-20");
  });
});

describe("inRange", () => {
  it("is inclusive of start and exclusive of end", () => {
    expect(inRange("2026-07-01", "2026-07-01", "2026-08-01")).toBe(true);
    expect(inRange("2026-07-31", "2026-07-01", "2026-08-01")).toBe(true);
    expect(inRange("2026-08-01", "2026-07-01", "2026-08-01")).toBe(false);
    expect(inRange("2026-06-30", "2026-07-01", "2026-08-01")).toBe(false);
  });
});

describe("addDays / toDayKey", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("emits a date-only UTC key", () => {
    expect(toDayKey(new Date("2026-07-15T23:59:00Z"))).toBe("2026-07-15");
  });
});

describe("bucketByDay", () => {
  it("groups events by day and orders most-severe first within a day", () => {
    const buckets = bucketByDay([
      event({ id: "a", date: "2026-07-02", severity: "info", title: "info task" }),
      event({ id: "b", date: "2026-07-02", severity: "critical", title: "critical task" }),
      event({ id: "c", date: "2026-07-02", severity: "warning", title: "warning task" }),
      event({ id: "d", date: "2026-07-05", severity: "info", title: "other day" }),
    ]);
    expect([...buckets.keys()].sort()).toEqual(["2026-07-02", "2026-07-05"]);
    expect(buckets.get("2026-07-02")!.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(buckets.get("2026-07-05")!.map((e) => e.id)).toEqual(["d"]);
  });

  it("returns an empty map for no events", () => {
    expect(bucketByDay([]).size).toBe(0);
  });
});
