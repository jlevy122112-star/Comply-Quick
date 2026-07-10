"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/lib/calendar/events";
import { CATEGORY_STYLE, longDate } from "./calendar-shared";

/** Agenda view: a flat, date-sorted list of open events for the month. */
export function AgendaList({
  agenda,
  today,
  busy,
  onMutate,
}: {
  agenda: CalendarEvent[];
  today: string;
  busy: boolean;
  onMutate: (id: string, action: "done" | "delete") => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-2">
      {agenda.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-500">
          Nothing scheduled this month. You&apos;re all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-gray-800/70">
          {agenda.map((ev) => {
            const overdue = ev.date < today;
            return (
              <li key={ev.id} className="flex items-center gap-3 px-3 py-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
                <div className="w-24 shrink-0 text-xs">
                  <span className={overdue ? "font-medium text-rose-300" : "text-gray-400"}>{longDate(ev.date)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{ev.title}</div>
                  <div className="text-xs text-gray-500">{CATEGORY_STYLE[ev.category].label}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {ev.href && (
                    <Link href={ev.href} className="text-xs text-sky-400 hover:text-sky-300">
                      Open
                    </Link>
                  )}
                  {ev.editable && (
                    <button
                      type="button"
                      onClick={() => onMutate(ev.id, "done")}
                      disabled={busy}
                      className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                    >
                      Done
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
