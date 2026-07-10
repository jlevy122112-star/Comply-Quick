"use client";

import type { CalendarEvent } from "@/lib/calendar/events";
import { CATEGORY_STYLE } from "./calendar-shared";

/** Compact event chip used inside month/week day cells. */
export function EventChip({
  ev,
  busy,
  onMutate,
}: {
  ev: CalendarEvent;
  busy: boolean;
  onMutate: (id: string, action: "done" | "delete") => void;
}) {
  return (
    <div
      title={ev.description || ev.title}
      className={`group flex items-center gap-1 rounded border px-1 py-0.5 text-[11px] leading-tight ${CATEGORY_STYLE[ev.category].chip} ${
        ev.status === "done" ? "line-through opacity-50" : ""
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
      <span className="flex-1 truncate">{ev.title}</span>
      {ev.editable && ev.status !== "done" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMutate(ev.id, "done");
          }}
          disabled={busy}
          className="hidden text-emerald-300 hover:text-emerald-200 group-hover:inline"
          title="Mark done"
        >
          ✓
        </button>
      )}
      {ev.editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMutate(ev.id, "delete");
          }}
          disabled={busy}
          className="hidden text-red-300 hover:text-red-200 group-hover:inline"
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  );
}
