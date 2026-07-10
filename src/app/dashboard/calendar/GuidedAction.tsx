import Link from "next/link";
import type { nextAction } from "@/lib/calendar/insights";
import { CATEGORY_STYLE } from "./calendar-shared";

type Guide = NonNullable<ReturnType<typeof nextAction>>;

/** "Next best action" banner surfacing the most urgent upcoming/overdue event. */
export function GuidedAction({
  guide,
  busy,
  onMarkDone,
}: {
  guide: Guide;
  busy: boolean;
  onMarkDone: (id: string) => void;
}) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
        guide.overdue ? "border-rose-500/40 bg-rose-500/[0.06]" : "border-sky-500/40 bg-sky-500/[0.06]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_STYLE[guide.event.category].dot}`} />
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {guide.overdue
              ? `Overdue by ${Math.abs(guide.daysUntil)} day${Math.abs(guide.daysUntil) === 1 ? "" : "s"}`
              : guide.daysUntil === 0
                ? "Due today"
                : `Due in ${guide.daysUntil} day${guide.daysUntil === 1 ? "" : "s"}`}
            {" · Next best action"}
          </div>
          <div className="truncate text-sm font-semibold text-white">{guide.event.title}</div>
          {guide.event.description && (
            <div className="mt-0.5 truncate text-xs text-gray-400">{guide.event.description}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {guide.event.href && (
          <Link
            href={guide.event.href}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
          >
            Open
          </Link>
        )}
        {guide.event.editable && (
          <button
            type="button"
            onClick={() => onMarkDone(guide.event.id)}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            Mark done
          </button>
        )}
      </div>
    </div>
  );
}
