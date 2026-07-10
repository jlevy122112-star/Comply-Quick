"use client";

import type { CalendarCategory } from "@/lib/calendar/events";

/** Inline add-task form for the calendar (title, due date, category). */
export function CalendarTaskForm({
  title,
  onTitleChange,
  dueDate,
  onDueDateChange,
  category,
  onCategoryChange,
  busy,
  onSubmit,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  dueDate: string;
  onDueDateChange: (v: string) => void;
  category: CalendarCategory;
  onCategoryChange: (v: CalendarCategory) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4"
    >
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs text-gray-400">Title</span>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Renew cookie-consent audit"
          className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-gray-400">Due date</span>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-gray-400">Type</span>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as CalendarCategory)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
        >
          <option value="task">Task</option>
          <option value="renewal">Renewal</option>
          <option value="scan">Scan</option>
          <option value="risk">Risk alert</option>
          <option value="regulation">Regulation</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save task"}
      </button>
    </form>
  );
}
