"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  Badge,
  Button,
  SeverityPill,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui";
import type { ProjectTask } from "@/lib/workspace/tasks";
import type { CalendarSeverity } from "@/lib/calendar/events";
import { createProjectTaskAction, setProjectTaskStatusAction, deleteProjectTaskAction } from "./task-actions";

const SEVERITIES: CalendarSeverity[] = ["info", "warning", "critical"];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TasksPanel({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayKey());
  const [severity, setSeverity] = useState<CalendarSeverity>("info");

  const open = tasks.filter((t) => t.status !== "done" && t.status !== "dismissed");
  const done = tasks.filter((t) => t.status === "done");

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("A task title is required.");
      return;
    }
    setBusyId("new");
    try {
      await createProjectTaskAction({ projectId, title: title.trim(), dueDate, severity });
      setTitle("");
      setSeverity("info");
      setDueDate(todayKey());
      setShowForm(false);
      refresh();
    } catch {
      setError("Could not create the task.");
    } finally {
      setBusyId(null);
    }
  }

  async function complete(id: string) {
    setBusyId(id);
    try {
      await setProjectTaskStatusAction(projectId, id, "done");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteProjectTaskAction(projectId, id);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  const disabled = busyId !== null || isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {open.length} open task{open.length !== 1 ? "s" : ""} for this project.
        </p>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add task"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardBody>
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-gray-400">Task</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Publish updated privacy policy"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Due</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Priority</span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as CalendarSeverity)}
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm" disabled={disabled}>
                {busyId === "new" ? "Adding…" : "Add"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </CardBody>
        </Card>
      )}

      {open.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No open tasks"
          description="Add a task to track remediation work for this project, or resolve findings to auto-generate them."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Priority</TH>
              <TH>Task</TH>
              <TH>Due</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {open.map((t) => (
              <TR key={t.id}>
                <TD>
                  <SeverityPill
                    severity={t.severity === "critical" ? "critical" : t.severity === "warning" ? "warning" : "info"}
                  />
                </TD>
                <TD>
                  <span className="font-medium text-white">{t.title}</span>
                  {t.source === "auto" && <span className="ml-2 text-xs text-gray-500">auto</span>}
                </TD>
                <TD className="tabular-nums text-gray-400">{t.dueDate}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" disabled={disabled} onClick={() => complete(t.id)}>
                      {busyId === t.id ? "…" : "Done"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => remove(t.id)}>
                      Delete
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {done.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-300">Completed ({done.length})</h3>
          <ul className="space-y-2">
            {done.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2">
                <span className="text-sm text-gray-500 line-through">{t.title}</span>
                <Badge tone="emerald">Done</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
