// Calendar + Alerts server service (Phase 9 / [Up7]).
//
// Aggregates a single compliance calendar from one owned table
// (`compliance_tasks`) plus events derived on the fly from existing features so
// nothing drifts from its source of truth:
//   • renewal   ← subscriptions.current_period_end
//   • scan      ← scan_monitors (next weekly re-scan due)
//   • risk      ← compliance_alerts (unresolved)
//   • regulation← notifications (Autopilot regulation-change alerts)
//
// Manual/auto tasks are the only rows persisted here; all reads/writes go
// through the RLS-scoped server client, so a user only ever sees their own data.

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/services";
import { UnauthorizedError, ValidationError, NotFoundError } from "@/services/errors";
import {
  monthRange,
  nextScanDue,
  toDayKey,
  parseDay,
  inRange,
  type CalendarEvent,
  type CalendarCategory,
  type CalendarSeverity,
  type CalendarStatus,
} from "./events";

const log = logger.child({ module: "calendar" });

const TASK_COLS =
  "id, user_id, agency_client_id, title, description, category, severity, due_date, status, source, related_scan_id, related_alert_id, metadata, completed_at, created_at, updated_at";

export interface ComplianceTask {
  id: string;
  agencyClientId: string | null;
  title: string;
  description: string;
  category: CalendarCategory;
  severity: CalendarSeverity;
  dueDate: string;
  status: CalendarStatus;
  source: "manual" | "auto";
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: CalendarCategory;
  severity?: CalendarSeverity;
  dueDate: string;
  agencyClientId?: string | null;
}

const CATEGORIES: CalendarCategory[] = ["task", "renewal", "scan", "risk", "regulation"];
const SEVERITIES: CalendarSeverity[] = ["info", "warning", "critical"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function mapTask(row: Record<string, unknown>): ComplianceTask {
  return {
    id: row.id as string,
    agencyClientId: (row.agency_client_id as string | null) ?? null,
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
  if (!user) throw new UnauthorizedError("Sign in to use the compliance calendar.");
  return { supabase, user };
}

/** Creates a manual compliance task owned by the caller. */
export async function createTask(input: CreateTaskInput): Promise<ComplianceTask> {
  const { supabase, user } = await requireUser();

  const title = input.title?.trim();
  if (!title) throw new ValidationError("A task title is required.");
  if (title.length > 200) throw new ValidationError("Title must be 200 characters or fewer.");
  if (!input.dueDate || !DAY_RE.test(input.dueDate))
    throw new ValidationError("A valid due date (YYYY-MM-DD) is required.");

  const category = input.category && CATEGORIES.includes(input.category) ? input.category : "task";
  const severity = input.severity && SEVERITIES.includes(input.severity) ? input.severity : "info";

  const { data, error } = await supabase
    .from("compliance_tasks")
    .insert({
      user_id: user.id,
      agency_client_id: input.agencyClientId ?? null,
      title,
      description: input.description?.trim() ?? "",
      category,
      severity,
      due_date: input.dueDate,
      source: "manual",
    })
    .select(TASK_COLS)
    .single();

  if (error || !data) {
    log.error("Failed to create task", { error: error?.message });
    throw new ValidationError("Could not create the task.");
  }
  return mapTask(data);
}

/** Marks a task done/pending/dismissed. Returns the updated task. */
export async function setTaskStatus(id: string, status: CalendarStatus): Promise<ComplianceTask> {
  const { supabase, user } = await requireUser();
  if (!(["pending", "done", "dismissed"] as CalendarStatus[]).includes(status))
    throw new ValidationError("Invalid task status.");

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

/** Deletes a task the caller owns. */
export async function deleteTask(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("compliance_tasks").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new ValidationError("Could not delete the task.");
}

function taskToEvent(t: ComplianceTask): CalendarEvent {
  return {
    id: t.id,
    date: t.dueDate,
    title: t.title,
    description: t.description,
    category: t.category,
    severity: t.severity,
    status: t.status,
    editable: true,
    href: null,
    agencyClientId: t.agencyClientId,
  };
}

export interface CalendarMonth {
  year: number;
  month: number;
  monthStart: string;
  gridStart: string;
  gridEnd: string;
  events: CalendarEvent[];
}

/**
 * Returns every calendar event visible in the month grid containing `ref`:
 * persisted tasks plus events derived from renewals, scan schedules, risk
 * alerts, and regulation notifications. When `agencyClientId` is set, only that
 * client's tasks are returned (derived personal events are omitted).
 */
export async function getCalendarMonth(
  ref: Date = new Date(),
  opts: { agencyClientId?: string | null } = {}
): Promise<CalendarMonth> {
  const { supabase, user } = await requireUser();
  const range = monthRange(ref);
  const events: CalendarEvent[] = [];

  // 1. Persisted tasks in the visible grid (optionally client-scoped).
  let taskQuery = supabase
    .from("compliance_tasks")
    .select(TASK_COLS)
    .eq("user_id", user.id)
    .gte("due_date", range.gridStart)
    .lt("due_date", range.gridEnd)
    .neq("status", "dismissed");
  taskQuery = opts.agencyClientId
    ? taskQuery.eq("agency_client_id", opts.agencyClientId)
    : taskQuery.is("agency_client_id", null);
  const { data: tasks } = await taskQuery;
  for (const row of tasks ?? []) events.push(taskToEvent(mapTask(row)));

  // Derived events are personal (not client-scoped); skip them in client view.
  if (opts.agencyClientId) {
    return { ...range, events };
  }

  // 2. Renewal reminder ← subscription current period end.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("current_period_end, status, tier")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.current_period_end && sub.status === "active" && sub.tier !== "free") {
    const day = toDayKey(new Date(sub.current_period_end as string));
    if (inRange(day, range.gridStart, range.gridEnd)) {
      events.push({
        id: `renewal:${user.id}`,
        date: day,
        title: "Subscription renews",
        description: `Your ${sub.tier} plan renews on this date.`,
        category: "renewal",
        severity: "info",
        status: "pending",
        editable: false,
        href: "/dashboard/home",
        agencyClientId: null,
      });
    }
  }

  // 3. Scan schedules ← next weekly re-scan for each active monitor.
  const { data: monitors } = await supabase
    .from("scan_monitors")
    .select("id, url, label, active, last_scanned_at, created_at")
    .eq("user_id", user.id)
    .eq("active", true);
  for (const m of monitors ?? []) {
    const due = nextScanDue({
      lastScannedAt: (m.last_scanned_at as string | null) ?? null,
      createdAt: m.created_at as string,
    });
    if (!inRange(due, range.gridStart, range.gridEnd)) continue;
    const label = (m.label as string) || (m.url as string);
    events.push({
      id: `scan:${m.id as string}:${due}`,
      date: due,
      title: `Scan due: ${label}`,
      description: "Weekly compliance re-scan is scheduled.",
      category: "scan",
      severity: "info",
      status: "pending",
      editable: false,
      href: "/dashboard/home",
      agencyClientId: null,
    });
  }

  // 4. Risk alerts ← unresolved compliance alerts raised in the window.
  const { data: alerts } = await supabase
    .from("compliance_alerts")
    .select("id, type, severity, title, body, created_at, resolved")
    .eq("user_id", user.id)
    .eq("resolved", false)
    .gte("created_at", `${range.gridStart}T00:00:00.000Z`)
    .lt("created_at", `${range.gridEnd}T00:00:00.000Z`);
  for (const a of alerts ?? []) {
    events.push({
      id: `alert:${a.id as string}`,
      date: toDayKey(new Date(a.created_at as string)),
      title: (a.title as string) || "Compliance alert",
      description: (a.body as string) ?? "",
      category: "risk",
      severity: normalizeSeverity(a.severity as string),
      status: "pending",
      editable: false,
      href: "/dashboard/home",
      agencyClientId: null,
    });
  }

  // 5. Regulation-change alerts ← Autopilot notifications in the window.
  const { data: notes } = await supabase
    .from("notifications")
    .select("id, type, title, body, created_at")
    .eq("user_id", user.id)
    .gte("created_at", `${range.gridStart}T00:00:00.000Z`)
    .lt("created_at", `${range.gridEnd}T00:00:00.000Z`);
  for (const n of notes ?? []) {
    events.push({
      id: `regulation:${n.id as string}`,
      date: toDayKey(new Date(n.created_at as string)),
      title: (n.title as string) || "Regulation update",
      description: (n.body as string) ?? "",
      category: "regulation",
      severity: "warning",
      status: "pending",
      editable: false,
      href: "/dashboard/autopilot",
      agencyClientId: null,
    });
  }

  return { ...range, events };
}

function normalizeSeverity(value: string): CalendarSeverity {
  return value === "critical" || value === "warning" ? value : "info";
}
