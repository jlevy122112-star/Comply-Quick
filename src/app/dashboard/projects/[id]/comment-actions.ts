"use server";

import { revalidatePath } from "next/cache";
import { listTaskComments, addTaskComment, deleteTaskComment, type TaskComment } from "@/lib/task-comments-db";

export async function listTaskCommentsAction(taskId: string): Promise<TaskComment[]> {
  return listTaskComments(taskId);
}

export async function addTaskCommentAction(projectId: string, taskId: string, body: string) {
  const result = await addTaskComment(taskId, body, projectId);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return result;
}

export async function deleteTaskCommentAction(projectId: string, id: string) {
  await deleteTaskComment(id);
  revalidatePath(`/dashboard/projects/${projectId}`);
}
