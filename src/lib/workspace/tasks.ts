// Project-scoped compliance tasks — the workspace Tasks tab data layer.
//
// Thin wrapper over the shared `compliance_tasks` table, filtered to one
// project (project_id). Account-wide calendar tasks (project_id NULL) are never
// returned here, and every read/write is RLS-scoped to the caller.

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organizations-db";
import { UnauthorizedError, ValidationError, NotFoundError } from "@/services/errors";
import {
  toDayKey,
  parseDay,
  type CalendarCategory,
  type CalendarSeverity,
  type CalendarStatus,
} from "@/lib/calendar/events";

const TASK_COLS = "id, project_id, title, description, category, severity, due_date, status, source, created_at";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES: CalendarCategory[] = ["task", "renewal", "scan", "risk", "regulation"];
const SEVERITIES: CalendarSeverity[] = ["info", "warning", "critical"];
const STATUSES: CalendarStatus[] = ["pending", "done", "dismissed"];

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: CalendarCategory;
  severity: CalendarSeverity;
  dueDate: string;
  status: CalendarStatus;
  source: "manual" | "auto";
  createdAt: string;
}

export interface NewProjectTaskInput {
  projectId: string;
  title: string;
  description?: string;
  category?: CalendarCategory;
  severity?: CalendarSeverity;
  dueDate: string;
}

function mapTask(row: Record<string, unknown>): ProjectTask {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    category: (row.category as CalendarCategory) ?? "task",
    severity: (row.severity as CalendarSeverity) ?? "info",
    dueDate: toDayKey(parseDay(row.due_date as string)),
    status: (row.status as CalendarStatus) ?? "pending",
    source: (row.source as "manual" | "auto") ?? "manual",
    createdAt: row.created_at as string,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError("Sign in to manage project tasks.");
  return { supabase, user };
}

/** Lists a project's tasks (soonest-due first). Returns [] when unauthenticated. */
export async function listProjectTasks(projectId: string): Promise<ProjectTask[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("compliance_tasks")
    .select(TASK_COLS)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .order("due_date", { ascending: true });

  return (data ?? []).map(mapTask);
}

/** Creates a manual task scoped to a project the caller owns. */
export async function createProjectTask(input: NewProjectTaskInput): Promise<ProjectTask> {
  const { supabase, user } = await requireUser();
  const organizationId = await getActiveOrganizationId();

  const title = input.title?.trim();
  if (!title) throw new ValidationError("A task title is required.");
  if (title.length > 200) throw new ValidationError("Title must be 200 characters or fewer.");
  if (!input.dueDate || !DAY_RE.test(input.dueDate))
    throw new ValidationError("A valid due date (YYYY-MM-DD) is required.");

  // Ensure the project belongs to the caller before attaching a task to it.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) throw new NotFoundError("Project not found.");

  const category = input.category && CATEGORIES.includes(input.category) ? input.category : "task";
  const severity = input.severity && SEVERITIES.includes(input.severity) ? input.severity : "info";

  const { data, error } = await supabase
    .from("compliance_tasks")
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      project_id: input.projectId,
      title,
      description: input.description?.trim() ?? "",
      category,
      severity,
      due_date: input.dueDate,
      source: "manual",
    })
    .select(TASK_COLS)
    .single();

  if (error || !data) throw new ValidationError("Could not create the task.");
  return mapTask(data);
}

/** Marks a project task done/pending/dismissed. */
export async function setProjectTaskStatus(id: string, status: CalendarStatus): Promise<ProjectTask> {
  const { supabase, user } = await requireUser();
  if (!STATUSES.includes(status)) throw new ValidationError("Invalid task status.");

  const { data, error } = await supabase
    .from("compliance_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(TASK_COLS)
    .maybeSingle();

  if (error) throw new ValidationError("Could not update the task.");
  if (!data) throw new NotFoundError("Task not found.");
  return mapTask(data);
}

/** Deletes a project task the caller owns. */
export async function deleteProjectTask(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("compliance_tasks").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new ValidationError("Could not delete the task.");
}
