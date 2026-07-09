"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { TaskComment } from "@/lib/task-comments-db";
import { listTaskCommentsAction, addTaskCommentAction, deleteTaskCommentAction } from "./comment-actions";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TaskComments({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listTaskCommentsAction(taskId).then((c) => {
      if (active) setComments(c);
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  async function reload() {
    setComments(await listTaskCommentsAction(taskId));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await addTaskCommentAction(projectId, taskId, body);
      if (res.ok) {
        setBody("");
        await reload();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteTaskCommentAction(projectId, id);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
      {comments === null ? (
        <p className="text-xs text-gray-500">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500">No comments yet. Start the discussion below.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-200">{c.authorEmail ?? "Teammate"}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatWhen(c.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={busy}
                    className="text-xs text-gray-600 hover:text-rose-400"
                    aria-label="Delete comment"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-gray-300">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder="Add a comment…"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={busy || body.trim().length === 0}>
          {busy ? "…" : "Post"}
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
