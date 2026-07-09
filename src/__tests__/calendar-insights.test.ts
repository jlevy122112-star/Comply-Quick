import { describe, it, expect } from "vitest";
import { summarizeEvents, heatLevel, nextAction } from "@/lib/calendar/insights";
import type { CalendarEvent } from "@/lib/calendar/events";

const TODAY = "2026-07-08";

function ev(partial: Partial<CalendarEvent> & { id: string; date: string }): CalendarEvent {
  return {
    title: partial.id,
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

describe("summarizeEvents", () => {
  it("counts overdue, due-today, next-7 and completion", () => {
    const events = [
      ev({ id: "a", date: "2026-07-01" }), // overdue
      ev({ id: "b", date: TODAY }), // due today
      ev({ id: "c", date: "2026-07-10" }), // next 7
      ev({ id: "d", date: "2026-07-30" }), // later this month
      ev({ id: "e", date: "2026-07-02", status: "done" }), // completed
    ];
    const s = summarizeEvents(events, TODAY);
    expect(s.total).toBe(5);
    expect(s.overdue).toBe(1);
    expect(s.dueToday).toBe(1);
    expect(s.next7).toBe(2); // due today + c
    expect(s.completed).toBe(1);
    expect(s.completionRate).toBe(20); // 1 done of 5 actionable+done
  });

  it("reports 100% completion and full health for an empty month", () => {
    const s = summarizeEvents([], TODAY);
    expect(s.completionRate).toBe(100);
    expect(s.onTrack).toBe(100);
  });

  it("drops on-track health as overdue items accumulate", () => {
    const overdue = [ev({ id: "x", date: "2026-07-01" }), ev({ id: "y", date: "2026-07-02" })];
    expect(summarizeEvents(overdue, TODAY).onTrack).toBe(70); // 100 - 2*15
  });
});

describe("heatLevel", () => {
  it("escalates to max on a critical event", () => {
    expect(heatLevel([ev({ id: "a", date: TODAY, severity: "critical" })])).toBe(3);
  });
  it("scales with actionable count", () => {
    expect(heatLevel([])).toBe(0);
    expect(heatLevel([ev({ id: "a", date: TODAY })])).toBe(1);
    expect(heatLevel([ev({ id: "a", date: TODAY }), ev({ id: "b", date: TODAY })])).toBe(2);
  });
  it("ignores completed events", () => {
    expect(heatLevel([ev({ id: "a", date: TODAY, status: "done" })])).toBe(0);
  });
  it("does not treat a dismissed critical event as active heat", () => {
    expect(heatLevel([ev({ id: "a", date: TODAY, severity: "critical", status: "dismissed" })])).toBe(0);
  });
});

describe("nextAction", () => {
  it("prioritises the oldest overdue item", () => {
    const na = nextAction([ev({ id: "soon", date: "2026-07-10" }), ev({ id: "old", date: "2026-07-01" })], TODAY);
    expect(na?.event.id).toBe("old");
    expect(na?.overdue).toBe(true);
    expect(na?.daysUntil).toBe(-7);
  });

  it("returns null when nothing is actionable", () => {
    expect(nextAction([ev({ id: "a", date: TODAY, status: "done" })], TODAY)).toBeNull();
  });
});
