"use client";

import { parseDay, type CalendarEvent } from "@/lib/calendar/events";
import { WEEKDAYS, weekDays } from "./calendar-shared";
import { EventChip } from "./EventChip";

/** Week grid: the Sunday-first week containing the selected day, one column per day. */
export function WeekGrid({
  selectedDay,
  buckets,
  today,
  busy,
  onMutate,
  onAddFor,
}: {
  selectedDay: string;
  buckets: Map<string, CalendarEvent[]>;
  today: string;
  busy: boolean;
  onMutate: (id: string, action: "done" | "delete") => void;
  onAddFor: (day: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800">
      <div className="grid grid-cols-7">
        {weekDays(selectedDay).map((day) => {
          const dayEvents = buckets.get(day) ?? [];
          const isToday = day === today;
          return (
            <div key={day} className="min-h-[16rem] border-b border-r border-gray-800/60 bg-gray-950 p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase text-gray-500">{WEEKDAYS[parseDay(day).getUTCDay()]}</span>
                <span
                  className={`flex h-6 w-6 items-center justify-center text-xs ${
                    isToday ? "rounded-full bg-sky-500 font-semibold text-white" : "text-gray-300"
                  }`}
                >
                  {parseDay(day).getUTCDate()}
                </span>
              </div>
              <div className="space-y-1">
                {dayEvents.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAddFor(day)}
                    className="w-full rounded border border-dashed border-gray-800 py-2 text-[11px] text-gray-600 hover:border-gray-600 hover:text-gray-400"
                  >
                    + Add
                  </button>
                ) : (
                  dayEvents.map((ev) => <EventChip key={ev.id} ev={ev} busy={busy} onMutate={onMutate} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
