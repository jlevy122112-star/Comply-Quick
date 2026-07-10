// Task comments — server data layer (framework §C12).
//
// A lightweight collaboration thread on a compliance task. RLS lets project
// members read and post (author must be the caller); authors may delete their
// own comments. Author email is resolved for display via the admin client, in
// one batched round-trip.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TaskComment {
  id: string;
  taskId: string;
  projectId: string | null;
  authorId: string;
  authorEmail: string | null;
  body: string;
  createdAt: string;
}

interface TaskCommentRow {
  id: string;
  task_id: string;
  project_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const rows = data as TaskCommentRow[];

  // Resolve author emails in one batched pass (auth.users isn't readable via
  // RLS). Unique ids only, concurrently — avoids an N+1 admin lookup.
  const emailById = new Map<string, string | null>();
  const admin = createAdminClient();
  const uniqueIds = [...new Set(rows.map((r) => r.author_id))];
  const looked = await Promise.all(
    uniqueIds.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      return [id, u?.user?.email ?? null] as const;
    })
  );
  for (const [id, email] of looked) emailById.set(id, email);

  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    authorId: r.author_id,
    authorEmail: emailById.get(r.author_id) ?? null,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function addTaskComment(
  taskId: string,
  body: string,
  projectId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (trimmed.length < 1) return { ok: false, error: "Comment can't be empty." };
  if (trimmed.length > 4000) return { ok: false, error: "Comment is too long (4000 char max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, project_id: projectId, author_id: user.id, body: trimmed });
  if (error) return { ok: false, error: "Could not post comment." };
  return { ok: true };
}

export async function deleteTaskComment(id: string): Promise<boolean> {
  const supabase = await createClient();
  // Return the deleted rows so an RLS-blocked delete (non-author) reports
  // failure instead of a false success — Postgres returns 0 rows, not an error.
  const { data, error } = await supabase.from("task_comments").delete().eq("id", id).select("id");
  return !error && (data?.length ?? 0) > 0;
}
