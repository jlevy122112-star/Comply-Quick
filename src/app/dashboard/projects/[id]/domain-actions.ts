"use server";

import { revalidatePath } from "next/cache";
import { addProjectDomain, removeProjectDomain } from "@/lib/project-domains-db";

export async function addProjectDomainAction(projectId: string, domain: string) {
  const result = await addProjectDomain(projectId, domain);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return result;
}

export async function removeProjectDomainAction(projectId: string, id: string) {
  await removeProjectDomain(id);
  revalidatePath(`/dashboard/projects/${projectId}`);
}
