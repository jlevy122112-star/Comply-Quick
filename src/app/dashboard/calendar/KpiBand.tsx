import { ScoreRing } from "@/components/ui";
import type { summarizeEvents } from "@/lib/calendar/insights";
import { StatCard } from "./StatCard";

type EventSummary = ReturnType<typeof summarizeEvents>;

/** Four-tile KPI band: compliance health, completion, overdue, due next 7 days. */
export function KpiBand({ summary }: { summary: EventSummary }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <ScoreRing score={summary.onTrack} size="sm" label="on track" />
        <div>
          <div className="text-sm font-semibold text-white">Compliance health</div>
          <div className="text-xs text-gray-400">
            {summary.overdue > 0 ? `${summary.overdue} overdue drag score` : "No overdue items"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <ScoreRing score={summary.completionRate} size="sm" label="done" />
        <div>
          <div className="text-sm font-semibold text-white">Completion</div>
          <div className="text-xs text-gray-400">
            {summary.completed} done · {summary.total - summary.completed} open
          </div>
        </div>
      </div>
      <StatCard
        value={summary.overdue}
        label="Overdue"
        tone={summary.overdue > 0 ? "rose" : "emerald"}
        hint={summary.overdue > 0 ? "Needs attention now" : "All clear"}
      />
      <StatCard
        value={summary.next7}
        label="Due next 7 days"
        tone={summary.next7 > 0 ? "amber" : "emerald"}
        hint={summary.dueToday > 0 ? `${summary.dueToday} due today` : "Plan ahead"}
      />
    </div>
  );
}
