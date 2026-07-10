"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Table, THead, TBody, TR, TH } from "@/components/ui";
import type { ProjectTask } from "@/lib/workspace/tasks";
import { setProjectTaskStatusAction, deleteProjectTaskAction } from "./task-actions";
import { AddTaskForm } from "./AddTaskForm";
import { TaskRow } from "./TaskRow";
import { CompletedTasksList } from "./CompletedTasksList";

export function TasksPanel({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);

  const open = tasks.filter((t) => t.status !== "done" && t.status !== "dismissed");
  const done = tasks.filter((t) => t.status === "done");

  function refresh() {
    startTransition(() => router.refresh());
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
        <AddTaskForm
          projectId={projectId}
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
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
              <TaskRow
                key={t.id}
                projectId={projectId}
                task={t}
                busy={busyId === t.id}
                disabled={disabled}
                commentsOpen={openComments === t.id}
                onToggleComments={() => setOpenComments((id) => (id === t.id ? null : t.id))}
                onComplete={() => complete(t.id)}
                onDelete={() => remove(t.id)}
              />
            ))}
          </TBody>
        </Table>
      )}

      <CompletedTasksList tasks={done} />
    </div>
  );
}
