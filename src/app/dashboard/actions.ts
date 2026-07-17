"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProject, deleteProjectById, type NewProjectInput } from "@/lib/projects-db";
import { setActiveOrganizationId } from "@/lib/organizations-db";

export async function saveProjectAction(input: NewProjectInput) {
  const project = await createProject(input);
  revalidatePath("/dashboard/home");
  return project;
}

export async function deleteProjectAction(id: string) {
  await deleteProjectById(id);
  revalidatePath("/dashboard/home");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function switchActiveOrganizationAction(
  organizationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ok = await setActiveOrganizationId(organizationId);
  return ok ? { ok: true } : { ok: false, error: "You are not a member of that organization." };
}
