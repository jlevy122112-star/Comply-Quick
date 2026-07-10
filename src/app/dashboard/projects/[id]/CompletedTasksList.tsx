import { Badge } from "@/components/ui";
import type { ProjectTask } from "@/lib/workspace/tasks";

/** Collapsed summary of completed tasks below the active list. */
export function CompletedTasksList({ tasks }: { tasks: ProjectTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-300">Completed ({tasks.length})</h3>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2">
            <span className="text-sm text-gray-500 line-through">{t.title}</span>
            <Badge tone="emerald">Done</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
