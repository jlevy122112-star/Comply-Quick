"use server";

import { revalidatePath } from "next/cache";
import { addProjectMember, removeProjectMember, type ProjectMemberRole } from "@/lib/workspace/members";

export async function addProjectMemberAction(projectId: string, email: string, role: ProjectMemberRole) {
  const result = await addProjectMember(projectId, email, role);
  if (result.ok) revalidatePath(`/dashboard/projects/${projectId}`);
  return result;
}

export async function removeProjectMemberAction(projectId: string, memberId: string) {
  await removeProjectMember(memberId);
  revalidatePath(`/dashboard/projects/${projectId}`);
}
