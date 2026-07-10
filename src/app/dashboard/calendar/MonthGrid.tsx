"use client";

import { parseDay, type CalendarEvent } from "@/lib/calendar/events";
import { heatLevel } from "@/lib/calendar/insights";
import { WEEKDAYS, HEAT_BG, HEAT_EDGE } from "./calendar-shared";
import { EventChip } from "./EventChip";

/** Month grid: 7-column weekday header + day cells with heat tint and event chips. */
export function MonthGrid({
  days,
  monthIndex,
  buckets,
  today,
  selectedDay,
  onSelectDay,
  busy,
  onMutate,
}: {
  days: string[];
  monthIndex: number;
  buckets: Map<string, CalendarEvent[]>;
  today: string;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  busy: boolean;
  onMutate: (id: string, action: "done" | "delete") => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800">
      <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-900/60">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = parseDay(day).getUTCMonth() === monthIndex;
          const dayEvents = buckets.get(day) ?? [];
          const level = heatLevel(dayEvents);
          const isToday = day === today;
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`min-h-[6.5rem] border-b border-r border-gray-800/60 p-1.5 text-left transition-colors ${
                inMonth ? "bg-gray-950" : "bg-gray-900/30"
              } ${HEAT_BG[level]} ${HEAT_EDGE[level]} ${
                isSelected ? "ring-1 ring-inset ring-sky-500/60" : "hover:bg-gray-900/60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center text-xs ${
                    isToday
                      ? "rounded-full bg-sky-500 font-semibold text-white"
                      : inMonth
                        ? "text-gray-300"
                        : "text-gray-600"
                  }`}
                >
                  {parseDay(day).getUTCDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] tabular-nums text-gray-500">{dayEvents.length}</span>
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} ev={ev} busy={busy} onMutate={onMutate} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 text-[10px] text-gray-500">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
