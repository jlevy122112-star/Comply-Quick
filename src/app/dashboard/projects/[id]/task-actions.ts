"use server";

import { revalidatePath } from "next/cache";
import {
  createProjectTask,
  setProjectTaskStatus,
  deleteProjectTask,
  type NewProjectTaskInput,
} from "@/lib/workspace/tasks";
import type { CalendarStatus } from "@/lib/calendar/events";

function revalidate(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function createProjectTaskAction(input: NewProjectTaskInput) {
  const task = await createProjectTask(input);
  revalidate(input.projectId);
  return task;
}

export async function setProjectTaskStatusAction(projectId: string, id: string, status: CalendarStatus) {
  const task = await setProjectTaskStatus(id, status);
  revalidate(projectId);
  return task;
}

export async function deleteProjectTaskAction(projectId: string, id: string) {
  await deleteProjectTask(id);
  revalidate(projectId);
}
