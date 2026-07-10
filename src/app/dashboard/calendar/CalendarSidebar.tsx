"use client";

import type { CalendarEvent, CalendarCategory } from "@/lib/calendar/events";
import { CATEGORY_STYLE, longDate } from "./calendar-shared";

/** Right rail: selected-day events, upcoming list, and the category legend. */
export function CalendarSidebar({
  selectedDay,
  selectedEvents,
  upcoming,
  busy,
  onMutate,
  onAddFor,
}: {
  selectedDay: string;
  selectedEvents: CalendarEvent[];
  upcoming: CalendarEvent[];
  busy: boolean;
  onMutate: (id: string, action: "done" | "delete") => void;
  onAddFor: (day: string) => void;
}) {
  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{longDate(selectedDay)}</h2>
          <button
            type="button"
            onClick={() => onAddFor(selectedDay)}
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            + Add
          </button>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No events on this day.</p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((ev) => (
              <li key={ev.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-gray-200">{ev.title}</div>
                  <div className="text-xs text-gray-500">{CATEGORY_STYLE[ev.category].label}</div>
                </div>
                {ev.editable && ev.status !== "done" && (
                  <button
                    type="button"
                    onClick={() => onMutate(ev.id, "done")}
                    disabled={busy}
                    className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                  >
                    ✓
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing scheduled this month.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((ev) => (
              <li key={ev.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
                <div className="min-w-0">
                  <div className="truncate text-gray-200">{ev.title}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(ev.date + "T00:00:00Z").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                    {" · "}
                    {CATEGORY_STYLE[ev.category].label}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Legend</h2>
        <ul className="space-y-2">
          {(Object.keys(CATEGORY_STYLE) as CalendarCategory[]).map((cat) => (
            <li key={cat} className="flex items-center gap-2 text-sm text-gray-300">
              <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_STYLE[cat].dot}`} />
              {CATEGORY_STYLE[cat].label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
