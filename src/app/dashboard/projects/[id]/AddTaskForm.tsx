"use client";

import { useState } from "react";
import { Card, CardBody, Button } from "@/components/ui";
import type { CalendarSeverity } from "@/lib/calendar/events";
import { createProjectTaskAction } from "./task-actions";

const SEVERITIES: CalendarSeverity[] = ["info", "warning", "critical"];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Inline add-task form; owns its own draft state and calls onCreated on success. */
export function AddTaskForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayKey());
  const [severity, setSeverity] = useState<CalendarSeverity>("info");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("A task title is required.");
      return;
    }
    setBusy(true);
    try {
      await createProjectTaskAction({ projectId, title: title.trim(), dueDate, severity });
      setTitle("");
      setSeverity("info");
      setDueDate(todayKey());
      onCreated();
    } catch {
      setError("Could not create the task.");
    } finally {
      setBusy(false);
    }
  }

  return (
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
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </CardBody>
    </Card>
  );
}
