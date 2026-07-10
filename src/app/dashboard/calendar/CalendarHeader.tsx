import Link from "next/link";
import type { ViewMode } from "./calendar-shared";

/** Calendar page header: title, view switcher, month nav, add-task & link actions. */
export function CalendarHeader({
  view,
  onViewChange,
  prevHref,
  nextHref,
  monthLabel,
  onToggleForm,
  onToggleLink,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  prevHref: string;
  nextHref: string;
  monthLabel: string;
  onToggleForm: () => void;
  onToggleLink: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Compliance Calendar</h1>
        <p className="mt-1 text-sm text-gray-400">
          Your compliance command center — deadlines, renewals, scans, and regulatory changes, on autopilot.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-gray-800 bg-gray-900/60 p-0.5">
          {(["month", "week", "agenda"] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onViewChange(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === m ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <Link
          href={prevHref}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          aria-label="Previous month"
        >
          &larr;
        </Link>
        <span className="min-w-[9rem] text-center font-medium text-white">{monthLabel}</span>
        <Link
          href={nextHref}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          aria-label="Next month"
        >
          &rarr;
        </Link>
        <button
          type="button"
          onClick={onToggleForm}
          className="ml-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
        >
          + Add task
        </button>
        <button
          type="button"
          onClick={onToggleLink}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
        >
          Link calendar
        </button>
      </div>
    </div>
  );
}
