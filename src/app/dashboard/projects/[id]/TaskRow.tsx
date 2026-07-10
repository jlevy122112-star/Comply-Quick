"use client";

import { Fragment } from "react";
import { Button, SeverityPill, TR, TD } from "@/components/ui";
import type { ProjectTask } from "@/lib/workspace/tasks";
import { TaskComments } from "./TaskComments";

/** One open-task table row with comments toggle, done, and delete controls. */
export function TaskRow({
  projectId,
  task,
  busy,
  disabled,
  commentsOpen,
  onToggleComments,
  onComplete,
  onDelete,
}: {
  projectId: string;
  task: ProjectTask;
  busy: boolean;
  disabled: boolean;
  commentsOpen: boolean;
  onToggleComments: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <Fragment>
      <TR>
        <TD>
          <SeverityPill
            severity={task.severity === "critical" ? "critical" : task.severity === "warning" ? "warning" : "info"}
          />
        </TD>
        <TD>
          <span className="font-medium text-white">{task.title}</span>
          {task.source === "auto" && <span className="ml-2 text-xs text-gray-500">auto</span>}
        </TD>
        <TD className="tabular-nums text-gray-400">{task.dueDate}</TD>
        <TD className="text-right">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onToggleComments}>
              {commentsOpen ? "Hide" : "Comments"}
            </Button>
            <Button size="sm" variant="secondary" disabled={disabled} onClick={onComplete}>
              {busy ? "…" : "Done"}
            </Button>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={onDelete}>
              Delete
            </Button>
          </div>
        </TD>
      </TR>
      {commentsOpen && (
        <TR>
          <TD colSpan={4}>
            <TaskComments projectId={projectId} taskId={task.id} />
          </TD>
        </TR>
      )}
    </Fragment>
  );
}
