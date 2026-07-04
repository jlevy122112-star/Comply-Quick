"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProject, deleteProjectById, type NewProjectInput } from "@/lib/projects-db";

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
